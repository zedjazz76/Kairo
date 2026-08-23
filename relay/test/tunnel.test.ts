import test from "node:test";
import assert from "node:assert/strict";
import { TunnelBroker } from "../src/tunnel/TunnelBroker.ts";

const sessionId = "session-1";
const now = 1_725_000_000_000;

function frame(sequence: number, expiresAt = now + 60_000) {
  return {
    sessionId,
    sequence,
    expiresAt,
    nonce: "AAAAAAAAAAAAAAAA",
    ciphertext: "k4Uqj3z09Q==",
  };
}

test("the relay routes opaque ciphertext without exposing Core command plaintext", async () => {
  const broker = new TunnelBroker({ now: () => now });
  broker.openSession({ sessionId, expiresAt: now + 60_000 });

  const captured = await broker.captureRoutedFrame(frame(1));

  assert.equal(captured.sessionId, sessionId);
  assert.equal(captured.sequence, 1);
  assert.equal(JSON.stringify(captured).includes("AbbaDox"), false);
});

test("expired frames are rejected", async () => {
  const broker = new TunnelBroker({ now: () => now });
  broker.openSession({ sessionId, expiresAt: now + 60_000 });

  await assert.rejects(
    broker.route(frame(1, now - 1)),
    /session_expired/,
  );
});

test("replayed sequence numbers are rejected", async () => {
  const broker = new TunnelBroker({ now: () => now });
  broker.openSession({ sessionId, expiresAt: now + 60_000 });

  await broker.route(frame(1));

  await assert.rejects(
    broker.route(frame(1)),
    /replay_detected/,
  );
});

test("disconnect immediately removes live routing state", async () => {
  const broker = new TunnelBroker({ now: () => now });
  broker.openSession({ sessionId, expiresAt: now + 60_000 });

  await broker.route(frame(1));
  broker.closeSession(sessionId);

  await assert.rejects(
    broker.route(frame(2)),
    /session_expired/,
  );
});
