import test from "node:test";
import assert from "node:assert/strict";
import { PairingService } from "../src/pairing/PairingService.ts";
import { PairedTunnelSession } from "../src/tunnel/PairedTunnelSession.ts";
import { TunnelBroker } from "../src/tunnel/TunnelBroker.ts";

const now = 1_725_000_000_000;

test("confirmed pairing is consumed to open exactly one tunnel session", async () => {
  const pairing = new PairingService({ now: () => now, codeTtlMillis: 60_000 });
  const broker = new TunnelBroker({ now: () => now });
  const pairedTunnel = new PairedTunnelSession({ pairing, broker, now: () => now });

  const offer = pairing.createOffer({ coreDeviceId: "android-core-1" });

  assert.throws(
    () => pairedTunnel.open({ pairingCode: offer.code, sessionId: "session-1" }),
    /pairing_not_confirmed/,
  );

  pairing.confirm({ code: offer.code, coreDeviceId: "android-core-1" });

  const session = pairedTunnel.open({ pairingCode: offer.code, sessionId: "session-1" });
  assert.equal(session.sessionId, "session-1");
  assert.equal(session.coreDeviceId, "android-core-1");

  await broker.route({
    sessionId: "session-1",
    sequence: 1,
    expiresAt: now + 30_000,
    nonce: "AAAAAAAAAAAAAAAA",
    ciphertext: "k4Uqj3z09Q==",
  });

  assert.throws(
    () => pairedTunnel.open({ pairingCode: offer.code, sessionId: "session-2" }),
    /pairing_unavailable/,
  );
});

test("paired tunnel session cannot outlive the confirmed pairing", () => {
  const pairing = new PairingService({ now: () => now, codeTtlMillis: 10_000 });
  const broker = new TunnelBroker({ now: () => now });
  const pairedTunnel = new PairedTunnelSession({ pairing, broker, now: () => now });

  const offer = pairing.createOffer({ coreDeviceId: "android-core-1" });
  pairing.confirm({ code: offer.code, coreDeviceId: "android-core-1" });

  const session = pairedTunnel.open({ pairingCode: offer.code, sessionId: "session-1" });
  assert.equal(session.expiresAt, offer.expiresAt);
});
