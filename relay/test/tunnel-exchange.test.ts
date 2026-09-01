import assert from "node:assert/strict";
import test from "node:test";
import { TunnelBroker, type TunnelFrame } from "../src/tunnel/TunnelBroker.ts";
import { TunnelExchangeBroker } from "../src/tunnel/TunnelExchangeBroker.ts";

const now = 1_725_000_000_000;
const expiresAt = now + 60_000;

function frame(sequence: number, ciphertext: string): TunnelFrame {
  return {
    sessionId: "session-1",
    sequence,
    expiresAt,
    nonce: "AAAAAAAAAAAAAAAA",
    ciphertext,
  };
}

test("relay exchanges one opaque command for its correlated opaque result without retaining either", async () => {
  const sessions = new TunnelBroker({ now: () => now });
  sessions.openSession({ sessionId: "session-1", expiresAt });
  const exchange = new TunnelExchangeBroker({ sessions, timeoutMs: 1_000 });
  const command = frame(1, "encrypted-command");
  const result = frame(1, "encrypted-result");

  const resultPromise = exchange.request(command);
  await Promise.resolve();
  assert.deepEqual(exchange.takeCommand("session-1"), command);
  await exchange.respond({
    sessionId: "session-1",
    requestSequence: command.sequence,
    frame: result,
  });

  assert.deepEqual(await resultPromise, result);
  assert.deepEqual(exchange.liveState(), {
    queuedCommands: 0,
    pendingResponses: 0,
  });
});
