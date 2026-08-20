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

test("rejects production-operation fields embedded in an allowed Core command", () => {
  const command = {
    requestId: "5d827e6f-7118-4c9e-ab31-f76b92b90efd",
    type: "AskKairo",
    contractVersion: "v1",
    payload: {
      question: "Which system hosts DMWL?",
      writeProductionConfiguration: { system: "PACS", enabled: true }
    }
  };

  assert.equal(validateCoreCommand(command).valid, false);
});

test("accepts representative exact Core command and result payloads", () => {
  const askCommand = {
    requestId: "02c42a6d-4887-4a70-bc3c-f75c5b113d34",
    type: "AskKairo",
    contractVersion: "v1",
    payload: { question: "Which system hosts DMWL?" }
  };
  const searchCommand = {
    requestId: "4c98b6cf-024f-4ca2-9b91-01cb6066afc4",
    type: "SearchKnowledge",
    contractVersion: "v1",
    payload: { query: "DMWL" }
  };
  const result = {
    requestId: askCommand.requestId,
    type: "AskKairo",
    contractVersion: "v1",
    status: "SUCCESS",
    data: { answerRef: "answer-1" }
  };
  const errorResult = {
    requestId: searchCommand.requestId,
    type: "SearchKnowledge",
    contractVersion: "v1",
    status: "ERROR",
    error: { code: "UNAVAILABLE" }
  };

  assert.equal(typeof validateCoreResult, "function");
  assert.equal(validateCoreCommand(askCommand).valid, true);
  assert.equal(validateCoreCommand(searchCommand).valid, true);
  assert.equal(validateCoreResult(result).valid, true);
  assert.equal(validateCoreResult(errorResult).valid, true);
});

test("rejects executable operation data in a Core result", () => {
  const result = {
    requestId: "57a5fcd6-f0d4-47ce-8795-ae7671c1b27c",
    type: "GetSystem",
    contractVersion: "v1",
    status: "SUCCESS",
    data: {
      systemRef: "system-1",
      executeProductionWrite: { system: "PACS", enabled: true }
    }
  };

  assert.equal(validateCoreResult(result).valid, false);
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
