import assert from "node:assert/strict";
import test from "node:test";

const { validateCoreCommand } = await import("../src/validateKairoAnswer.ts");

test("accepts a dedicated DeepAnalyze Core command", () => {
  const command = {
    requestId: "4a61a3b8-cc9f-4b9e-92ac-7c2e5a274d65",
    type: "DeepAnalyze",
    contractVersion: "v1",
    payload: {
      question: "Why are studies not reaching MagView?",
    },
  };

  assert.equal(validateCoreCommand(command).valid, true);
});
