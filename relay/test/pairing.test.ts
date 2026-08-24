import test from "node:test";
import assert from "node:assert/strict";
import { PairingService } from "../src/pairing/PairingService.ts";

const now = 1_725_000_000_000;

test("pairing code requires explicit Core confirmation before consumption", () => {
  const service = new PairingService({ now: () => now, codeTtlMillis: 60_000 });
  const offer = service.createOffer({ coreDeviceId: "android-core-1" });

  assert.equal(service.consumeConfirmed(offer.code), null);

  service.confirm({ code: offer.code, coreDeviceId: "android-core-1" });

  const session = service.consumeConfirmed(offer.code);
  assert.equal(session?.coreDeviceId, "android-core-1");
  assert.equal(session?.pairingCode, offer.code);
});

test("pairing code is one-time use", () => {
  const service = new PairingService({ now: () => now, codeTtlMillis: 60_000 });
  const offer = service.createOffer({ coreDeviceId: "android-core-1" });
  service.confirm({ code: offer.code, coreDeviceId: "android-core-1" });

  assert.ok(service.consumeConfirmed(offer.code));
  assert.equal(service.consumeConfirmed(offer.code), null);
});

test("expired pairing code cannot be confirmed or consumed", () => {
  let clock = now;
  const service = new PairingService({ now: () => clock, codeTtlMillis: 1_000 });
  const offer = service.createOffer({ coreDeviceId: "android-core-1" });

  clock += 1_001;

  assert.throws(
    () => service.confirm({ code: offer.code, coreDeviceId: "android-core-1" }),
    /pairing_expired/,
  );
  assert.equal(service.consumeConfirmed(offer.code), null);
});

test("confirmation from a different Core device is rejected", () => {
  const service = new PairingService({ now: () => now, codeTtlMillis: 60_000 });
  const offer = service.createOffer({ coreDeviceId: "android-core-1" });

  assert.throws(
    () => service.confirm({ code: offer.code, coreDeviceId: "other-core" }),
    /pairing_device_mismatch/,
  );
});

test("cancelled pairing code cannot be confirmed or consumed", () => {
  const service = new PairingService({ now: () => now, codeTtlMillis: 60_000 });
  const offer = service.createOffer({ coreDeviceId: "android-core-1" });

  service.cancel({ code: offer.code, coreDeviceId: "android-core-1" });

  assert.throws(
    () => service.confirm({ code: offer.code, coreDeviceId: "android-core-1" }),
    /pairing_cancelled/,
  );
  assert.equal(service.consumeConfirmed(offer.code), null);
});

test("pairing cancellation is bound to the same Core device", () => {
  const service = new PairingService({ now: () => now, codeTtlMillis: 60_000 });
  const offer = service.createOffer({ coreDeviceId: "android-core-1" });

  assert.throws(
    () => service.cancel({ code: offer.code, coreDeviceId: "other-core" }),
    /pairing_device_mismatch/,
  );
});
