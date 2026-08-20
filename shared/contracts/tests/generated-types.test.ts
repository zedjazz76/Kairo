import assert from "node:assert/strict";
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
