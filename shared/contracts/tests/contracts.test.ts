import assert from "node:assert/strict";
import test from "node:test";

const {
  validateKairoAnswer,
  validateCoreCommand,
  validateCoreResult
} = await import("../src/validateKairoAnswer.ts");

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
        temporalContext: "CURRENT",
        evidenceState: "CONFIRMED",
        evidenceRefs: ["evidence-1"]
      }
    ]
  };

  assert.equal(validateKairoAnswer(answer).valid, true);
});

test("rejects an answer claim without temporal architecture context", () => {
  const answer = {
    assessment: "The future PACS route is planned",
    claims: [
      {
        text: "The future PACS route is planned",
        scope: "MANA_PRODUCTION",
        evidenceState: "PLANNED",
        evidenceRefs: ["evidence-2"]
      }
    ]
  };

  assert.equal(validateKairoAnswer(answer).valid, false);
});

test("distinguishes current MANA understanding from planned future MANA architecture", () => {
  const current = {
    assessment: "Current MANA DMWL route",
    claims: [
      {
        text: "Merge PACS hosts the current DMWL route",
        scope: "MANA_PRODUCTION",
        temporalContext: "CURRENT",
        evidenceState: "CONFIRMED",
        evidenceRefs: ["evidence-current"]
      }
    ]
  };
  const future = {
    assessment: "Planned future MANA DMWL route",
    claims: [
      {
        text: "AbbaDox will host the future DMWL route",
        scope: "MANA_PRODUCTION",
        temporalContext: "FUTURE",
        evidenceState: "PLANNED",
        evidenceRefs: ["evidence-future"]
      }
    ]
  };

  assert.equal(validateKairoAnswer(current).valid, true);
  assert.equal(validateKairoAnswer(future).valid, true);
  assert.notEqual(
    current.claims[0].temporalContext,
    future.claims[0].temporalContext
  );
});

test("rejects a production-write command outside the approved Core capability set", () => {
  const command = {
    requestId: "c2ee4d7d-8c2c-4d3e-948b-2f00828e6184",
    type: "WriteProductionConfiguration",
    contractVersion: "v1",
    payload: { target: "PACS", enabled: true }
  };

  assert.equal(typeof validateCoreCommand, "function");
  assert.equal(validateCoreCommand(command).valid, false);
});

test("accepts approved Core commands and matching result envelopes", () => {
  const command = {
    requestId: "02c42a6d-4887-4a70-bc3c-f75c5b113d34",
    type: "AskKairo",
    contractVersion: "v1",
    payload: { question: "Which system hosts DMWL?" }
  };
  const result = {
    requestId: command.requestId,
    type: "AskKairo",
    contractVersion: "v1",
    payload: { answer: "Insufficient MANA evidence." }
  };

  assert.equal(typeof validateCoreResult, "function");
  assert.equal(validateCoreCommand(command).valid, true);
  assert.equal(validateCoreResult(result).valid, true);
});

test("parses the relay contract and requires paired encrypted live-only routing", async () => {
  const relay = JSON.parse(
    await (await import("node:fs/promises")).readFile(
      new URL("../openapi/kairo-relay.v1.yaml", import.meta.url),
      "utf8"
    )
  );

  assert.ok(relay.paths["/v1/pairings"].post);
  assert.ok(relay.paths["/v1/pairings/{pairingId}/confirm"].post);
  assert.ok(relay.paths["/v1/tunnels/{sessionId}/commands"].post);
  assert.deepEqual(relay.security, [{ pairedTunnel: [] }]);
  assert.equal(relay["x-kairo-relay"].liveRoutingOnly, true);
  assert.equal(relay["x-kairo-relay"].permanentRetention, "prohibited");
  assert.equal(
    relay.components.schemas.EncryptedFrameV1.properties.ciphertext.contentEncoding,
    "base64"
  );
});
