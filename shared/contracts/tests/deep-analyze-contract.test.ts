import assert from "node:assert/strict";
import test from "node:test";

const { validateCoreCommand } = await import("../src/validateKairoAnswer.ts");

test("accepts a dedicated DeepAnalyze Core command", () => {
  const command = {
    requestId: "deep-1",
    type: "DeepAnalyze",
    contractVersion: "v1",
    payload: {
      question: "Why are studies not reaching MagView?",
    },
  };

  assert.equal(validateCoreCommand(command).valid, true);
});
