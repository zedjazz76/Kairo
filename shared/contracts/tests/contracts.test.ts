import assert from "node:assert/strict";
import test from "node:test";

let validateKairoAnswer;

try {
  ({ validateKairoAnswer } = await import("../src/validateKairoAnswer.ts"));
} catch {
  validateKairoAnswer = undefined;
}

test("rejects an answer claim without scope, state, or evidence", () => {
  const answer = {
    assessment: "PACS hosts DMWL",
    claims: [{ text: "PACS hosts DMWL" }]
  };

  assert.equal(
    typeof validateKairoAnswer,
    "function",
    "KairoAnswer validation is not implemented"
  );
  assert.equal(validateKairoAnswer(answer).valid, false);
});

test("accepts an answer claim with scope, state, and evidence", () => {
  const answer = {
    assessment: "Merge PACS hosts DMWL",
    claims: [
      {
        text: "Merge PACS hosts DMWL",
        scope: "MANA_PRODUCTION",
        evidenceState: "CONFIRMED",
        evidenceRefs: ["evidence-1"]
      }
    ]
  };

  assert.equal(validateKairoAnswer(answer).valid, true);
});
