import type {
  EncryptedTunnelFrame,
  TunnelFrameTransport,
} from "./pairedTunnel.ts";

export type RelayTunnelFrameTransportOptions = {
  relayUrl: string;
  sessionId: string;
  fetch?: typeof globalThis.fetch;
};

export class RelayTunnelFrameTransport implements TunnelFrameTransport {
  private readonly relayUrl: string;
  private readonly sessionId: string;
  private readonly fetch: typeof globalThis.fetch;
  private connected = true;

  constructor(options: RelayTunnelFrameTransportOptions) {
    this.relayUrl = options.relayUrl.replace(/\/$/, "");
    this.sessionId = options.sessionId;
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async send(frame: EncryptedTunnelFrame): Promise<void> {
    await this.request(frame);
  }

  async request(frame: EncryptedTunnelFrame): Promise<EncryptedTunnelFrame> {
    this.requireConnectedFrame(frame);
    const response = await this.fetch(
      `${this.relayUrl}/v1/tunnel/${encodeURIComponent(this.sessionId)}/requests`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(frame),
      },
    );
    if (!response.ok) {
      throw new Error("tunnel_transport_failed");
    }
    return parseEncryptedFrame(await response.json(), this.sessionId);
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    this.connected = false;
    const response = await this.fetch(
      `${this.relayUrl}/v1/tunnel/${encodeURIComponent(this.sessionId)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      throw new Error("tunnel_disconnect_failed");
    }
  }

  private requireConnectedFrame(frame: EncryptedTunnelFrame): void {
    if (!this.connected) {
      throw new Error("tunnel_not_connected");
    }
    if (frame.sessionId !== this.sessionId) {
      throw new Error("tunnel_session_mismatch");
    }
  }
}

function parseEncryptedFrame(
  value: unknown,
  expectedSessionId: string,
): EncryptedTunnelFrame {
  if (typeof value !== "object" || value === null) {
    throw new Error("invalid_tunnel_frame");
  }
  const frame = value as Record<string, unknown>;
  if (
    frame.sessionId !== expectedSessionId ||
    !Number.isSafeInteger(frame.sequence) ||
    (frame.sequence as number) <= 0 ||
    !Number.isSafeInteger(frame.expiresAt) ||
    (frame.expiresAt as number) <= 0 ||
    typeof frame.nonce !== "string" ||
    frame.nonce.length === 0 ||
    typeof frame.ciphertext !== "string" ||
    frame.ciphertext.length === 0
  ) {
    throw new Error("invalid_tunnel_frame");
  }
  return frame as EncryptedTunnelFrame;
}
