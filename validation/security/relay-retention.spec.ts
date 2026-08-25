import assert from "node:assert/strict";
import test from "node:test";
import { PairingService } from "../../relay/src/pairing/PairingService.ts";
import { TunnelBroker } from "../../relay/src/tunnel/TunnelBroker.ts";
import { PairedTunnelSession } from "../../relay/src/tunnel/PairedTunnelSession.ts";

test("relay retains only live ciphertext routing state and deletes it on disconnect", async () => {
  let now = 1_000;
  const pairing = new PairingService({ now: () => now, codeTtlMillis: 100 });
  const broker = new TunnelBroker({ now: () => now });
  const session = new PairedTunnelSession({ pairing, broker, now: () => now });
  const offer = pairing.createOffer({ coreDeviceId: "core-release-test" });
  pairing.confirm({ code: offer.code, coreDeviceId: "core-release-test" });
  session.open({ pairingCode: offer.code, sessionId: "release-session" });

  const routed = await broker.captureRoutedFrame({
    sessionId: "release-session",
    sequence: 1,
    expiresAt: offer.expiresAt,
    nonce: "nonce-only",
    ciphertext: "ciphertext-only",
  });
  assert.deepEqual(routed, {
    sessionId: "release-session",
    sequence: 1,
    expiresAt: offer.expiresAt,
    nonce: "nonce-only",
    ciphertext: "ciphertext-only",
  });
  assert.equal(JSON.stringify(routed).includes("SYNTHETIC_MRN_424242"), false);

  await assert.rejects(
    broker.route({ ...routed, sequence: 1 }),
    /replay_detected/,
  );
  broker.closeSession("release-session");
  await assert.rejects(broker.route({ ...routed, sequence: 2 }), /session_expired/);
  now = offer.expiresAt + 1;
  await assert.rejects(broker.route({ ...routed, sequence: 3 }), /session_expired/);
});
