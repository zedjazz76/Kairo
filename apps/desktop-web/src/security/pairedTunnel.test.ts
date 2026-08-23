import test from "node:test";
import assert from "node:assert/strict";
import {
  createEphemeralKeyPair,
  decryptTunnelFrame,
  deriveSessionKey,
  encryptTunnelFrame,
} from "./pairedTunnel.ts";

test("paired peers derive compatible keys and ciphertext hides command plaintext", async () => {
  const browser = await createEphemeralKeyPair();
  const core = await createEphemeralKeyPair();
  const salt = crypto.getRandomValues(new Uint8Array(32));

  const browserKey = await deriveSessionKey(browser.privateKey, core.publicKey, salt);
  const coreKey = await deriveSessionKey(core.privateKey, browser.publicKey, salt);

  const plaintext = JSON.stringify({ type: "ASK_KAIRO", payload: { question: "What is AbbaDox routing?" } });
  const frame = await encryptTunnelFrame(
    browserKey,
    { sessionId: "session-1", sequence: 1, expiresAt: Date.now() + 60_000 },
    plaintext,
  );

  assert.equal(JSON.stringify(frame).includes("AbbaDox"), false);
  assert.equal(await decryptTunnelFrame(coreKey, frame), plaintext);
});

test("corrupted encrypted frames are rejected", async () => {
  const browser = await createEphemeralKeyPair();
  const core = await createEphemeralKeyPair();
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const browserKey = await deriveSessionKey(browser.privateKey, core.publicKey, salt);
  const coreKey = await deriveSessionKey(core.privateKey, browser.publicKey, salt);

  const frame = await encryptTunnelFrame(
    browserKey,
    { sessionId: "session-1", sequence: 1, expiresAt: Date.now() + 60_000 },
    "sensitive payload",
  );
  frame.ciphertext = frame.ciphertext.slice(0, -2) + "AA";

  await assert.rejects(decryptTunnelFrame(coreKey, frame));
});
