import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

let generateContractTypes;

try {
  ({ generateContractTypes } = await import(
    "../../../scripts/generate-contract-types.mjs"
  ));
} catch {
  generateContractTypes = undefined;
}

test("generated TypeScript declarations are fresh from the committed schemas", () => {
  assert.equal(
    typeof generateContractTypes,
    "function",
    "the deterministic contract type generator is not implemented"
  );

  assert.equal(generateContractTypes({ check: true }).clean, true);
});

test("generated Core declarations preserve exact payload unions", () => {
  const declarations = readFileSync(
    new URL("../generated/contracts.v1.ts", import.meta.url),
    "utf8"
  );

  assert.match(declarations, /export type CoreCommandV1 =/);
  assert.match(declarations, /AskKairoCommandPayloadV1/);
  assert.match(declarations, /export type CoreResultV1 =/);
  assert.match(declarations, /AskKairoSuccessDataV1/);
});

test("generated result unions exclude the prohibited branch properties", () => {
  const declarations = readFileSync(
    new URL("../generated/contracts.v1.ts", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(
    declarations,
    /status: "SUCCESS"; data: AskKairoSuccessDataV1; error[?]:/
  );
  assert.doesNotMatch(
    declarations,
    /status: "ERROR"; data[?]: Record<string, unknown>; error: CoreErrorV1/
  );
});
