import {
  TunnelBroker,
  type TunnelFrame,
} from "./TunnelBroker.ts";

type PendingResponse = {
  command: TunnelFrame;
  resolve(frame: TunnelFrame): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
};

export type TunnelExchangeBrokerOptions = {
  sessions: TunnelBroker;
  timeoutMs?: number;
};

export class TunnelExchangeBroker {
  private readonly sessions: TunnelBroker;
  private readonly timeoutMs: number;
  private readonly commands = new Map<string, TunnelFrame[]>();
  private readonly pending = new Map<string, PendingResponse>();

  constructor(options: TunnelExchangeBrokerOptions) {
    this.sessions = options.sessions;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async request(command: TunnelFrame): Promise<TunnelFrame> {
    await this.sessions.route(command, "browser-to-core");
    const key = requestKey(command.sessionId, command.sequence);

    const queued = this.commands.get(command.sessionId) ?? [];
    queued.push(command);
    this.commands.set(command.sessionId, queued);

    return new Promise<TunnelFrame>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(key);
        this.removeQueued(command);
        reject(new Error("tunnel_response_timeout"));
      }, this.timeoutMs);

      this.pending.set(key, {
        command,
        resolve,
        reject,
        timer,
      });
    });
  }

  takeCommand(sessionId: string): TunnelFrame | null {
    const queued = this.commands.get(sessionId);
    const command = queued?.shift() ?? null;
    if (queued?.length === 0) {
      this.commands.delete(sessionId);
    }
    return command;
  }

  async respond(input: {
    sessionId: string;
    requestSequence: number;
    frame: TunnelFrame;
  }): Promise<void> {
    if (input.frame.sessionId !== input.sessionId) {
      throw new Error("tunnel_session_mismatch");
    }

    await this.sessions.route(input.frame, "core-to-browser");
    const key = requestKey(input.sessionId, input.requestSequence);
    const pending = this.pending.get(key);
    if (!pending) {
      throw new Error("tunnel_request_not_found");
    }

    clearTimeout(pending.timer);
    this.pending.delete(key);
    this.removeQueued(pending.command);
    pending.resolve(input.frame);
  }

  closeSession(sessionId: string): void {
    this.commands.delete(sessionId);
    for (const [key, pending] of this.pending.entries()) {
      if (pending.command.sessionId !== sessionId) continue;
      clearTimeout(pending.timer);
      this.pending.delete(key);
      pending.reject(new Error("tunnel_not_connected"));
    }
    this.sessions.closeSession(sessionId);
  }

  liveState(): { queuedCommands: number; pendingResponses: number } {
    return {
      queuedCommands: Array.from(this.commands.values()).reduce(
        (total, queued) => total + queued.length,
        0,
      ),
      pendingResponses: this.pending.size,
    };
  }

  private removeQueued(command: TunnelFrame): void {
    const queued = this.commands.get(command.sessionId);
    if (!queued) return;
    const remaining = queued.filter((candidate) => candidate.sequence !== command.sequence);
    if (remaining.length === 0) {
      this.commands.delete(command.sessionId);
    } else {
      this.commands.set(command.sessionId, remaining);
    }
  }
}

function requestKey(sessionId: string, sequence: number): string {
  return `${sessionId}:${sequence}`;
}
