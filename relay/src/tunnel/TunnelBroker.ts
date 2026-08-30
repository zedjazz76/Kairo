export type TunnelFrame = {
  sessionId: string;
  sequence: number;
  expiresAt: number;
  nonce: string;
  ciphertext: string;
};

type SessionState = {
  expiresAt: number;
  lastSequence: Record<TunnelDirection, number>;
};

export type TunnelDirection = "browser-to-core" | "core-to-browser";

type TunnelBrokerOptions = {
  now?: () => number;
};

export class TunnelBroker {
  private readonly now: () => number;
  private readonly sessions = new Map<string, SessionState>();

  constructor(options: TunnelBrokerOptions = {}) {
    this.now = options.now ?? Date.now;
  }

  openSession(input: { sessionId: string; expiresAt: number }): void {
    this.sessions.set(input.sessionId, {
      expiresAt: input.expiresAt,
      lastSequence: {
        "browser-to-core": 0,
        "core-to-browser": 0,
      },
    });
  }

  closeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  async route(
    frame: TunnelFrame,
    direction: TunnelDirection = "browser-to-core",
  ): Promise<void> {
    const session = this.sessions.get(frame.sessionId);
    const currentTime = this.now();

    if (!session || session.expiresAt <= currentTime || frame.expiresAt <= currentTime) {
      throw new Error("session_expired");
    }

    if (frame.sequence <= session.lastSequence[direction]) {
      throw new Error("replay_detected");
    }

    session.lastSequence[direction] = frame.sequence;
  }

  async captureRoutedFrame(frame: TunnelFrame): Promise<TunnelFrame> {
    await this.route(frame);

    return {
      sessionId: frame.sessionId,
      sequence: frame.sequence,
      expiresAt: frame.expiresAt,
      nonce: frame.nonce,
      ciphertext: frame.ciphertext,
    };
  }
}
