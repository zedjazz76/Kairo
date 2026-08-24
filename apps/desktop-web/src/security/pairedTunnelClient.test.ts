import test from "node:test";
import assert from "node:assert/strict";
import {
  PairedTunnelClient,
  createEphemeralKeyPair,
  deriveSessionKey,
  type EncryptedTunnelFrame,
  type TunnelFrameTransport,
} from "./pairedTunnel.ts";

const now = 1_725_000_000_000;

class RecordingTransport implements TunnelFrameTransport {
  readonly frames: EncryptedTunnelFrame[] = [];
  disconnectCount = 0;

  async send(frame: EncryptedTunnelFrame): Promise<void> {
    this.frames.push(frame);
  }

  async disconnect(): Promise<void> {
    this.disconnectCount += 1;
  }
}

async function sessionKey(): Promise<CryptoKey> {
  const browser = await createEphemeralKeyPair();
  const core = await createEphemeralKeyPair();
  const salt = new Uint8Array(32).fill(7);
  return deriveSessionKey(browser.privateKey, core.publicKey, salt);
}

test("paired browser client encrypts commands with monotonic sequence numbers", async () => {
  const transport = new RecordingTransport();
  const client = new PairedTunnelClient({
    sessionId: "session-1",
    expiresAt: now + 60_000,
    sessionKey: await sessionKey(),
    transport,
    now: () => now,
  });

  await client.sendPlaintext("ASK_KAIRO AbbaDox");
  await client.sendPlaintext("SECOND COMMAND");

  assert.deepEqual(transport.frames.map((frame) => frame.sequence), [1, 2]);
  assert.equal(transport.frames.every((frame) => frame.sessionId === "session-1"), true);
  assert.equal(JSON.stringify(transport.frames).includes("AbbaDox"), false);
});

test("expired or disconnected browser tunnel fails closed", async () => {
  const transport = new RecordingTransport();
  const key = await sessionKey();

  const expired = new PairedTunnelClient({
    sessionId: "session-expired",
    expiresAt: now - 1,
    sessionKey: key,
    transport,
    now: () => now,
  });

  await assert.rejects(expired.sendPlaintext("payload"), /session_expired/);

  const connected = new PairedTunnelClient({
    sessionId: "session-1",
    expiresAt: now + 60_000,
    sessionKey: key,
    transport,
    now: () => now,
  });

  await connected.disconnect();
  assert.equal(transport.disconnectCount, 1);
  await assert.rejects(connected.sendPlaintext("payload"), /tunnel_not_connected/);
});
