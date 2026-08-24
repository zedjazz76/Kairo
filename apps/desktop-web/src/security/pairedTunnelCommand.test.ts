import test from "node:test";
import assert from "node:assert/strict";
import type { CoreCommandV1 } from "../../../../shared/contracts/generated/contracts.v1.ts";
import {
  PairedTunnelClient,
  createEphemeralKeyPair,
  decryptTunnelFrame,
  deriveSessionKey,
  type EncryptedTunnelFrame,
  type TunnelFrameTransport,
} from "./pairedTunnel.ts";

const now = 1_725_000_000_000;

class RecordingTransport implements TunnelFrameTransport {
  readonly frames: EncryptedTunnelFrame[] = [];

  async send(frame: EncryptedTunnelFrame): Promise<void> {
    this.frames.push(frame);
  }

  async disconnect(): Promise<void> {}
}

test("paired browser client sends a CoreCommandV1 envelope without exposing command plaintext", async () => {
  const browser = await createEphemeralKeyPair();
  const core = await createEphemeralKeyPair();
  const salt = new Uint8Array(32).fill(11);
  const browserKey = await deriveSessionKey(browser.privateKey, core.publicKey, salt);
  const coreKey = await deriveSessionKey(core.privateKey, browser.publicKey, salt);
  const transport = new RecordingTransport();
  const client = new PairedTunnelClient({
    sessionId: "session-1",
    expiresAt: now + 60_000,
    sessionKey: browserKey,
    transport,
    now: () => now,
  });

  const command: CoreCommandV1 = {
    requestId: "request-1",
    type: "AskKairo",
    contractVersion: "v1",
    payload: {
      question: "What is AbbaDox routing?",
    },
  };

  await client.sendCommand(command);

  assert.equal(transport.frames.length, 1);
  assert.equal(JSON.stringify(transport.frames[0]).includes("AbbaDox"), false);
  assert.deepEqual(
    JSON.parse(await decryptTunnelFrame(coreKey, transport.frames[0])),
    command,
  );
});
