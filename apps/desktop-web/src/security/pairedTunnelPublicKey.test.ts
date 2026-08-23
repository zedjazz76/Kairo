import test from "node:test";
import assert from "node:assert/strict";
import {
  createEphemeralKeyPair,
  exportPublicKey,
  importPublicKey,
} from "./pairedTunnel.ts";

test("browser public keys round trip through portable uncompressed P-256 encoding", async () => {
  const pair = await createEphemeralKeyPair();

  const exported = await exportPublicKey(pair.publicKey);
  assert.equal(exported.byteLength, 65);
  assert.equal(exported[0], 0x04);

  const imported = await importPublicKey(exported);
  const reExported = await exportPublicKey(imported);

  assert.deepEqual(Array.from(reExported), Array.from(exported));
});

test("browser rejects malformed portable public keys", async () => {
  await assert.rejects(
    importPublicKey(new Uint8Array([0x04, 0x01, 0x02])),
    /invalid_public_key/,
  );
});
