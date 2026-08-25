import assert from "node:assert/strict";
import { request } from "node:http";
import test from "node:test";
import { startLocalRelay } from "../src/runtime/LocalRelayRuntime.ts";

test("local relay accepts one bounded Deep Analyze request without retaining its body", async () => {
  const seen: unknown[] = [];
  const relay = await startLocalRelay({
    host: "127.0.0.1",
    port: 0,
    gateway: {
      async analyze(request) {
        seen.push(request);
        return {
          text: "Evidence-bound result.",
          claims: [
            {
              text: "A verified claim.",
              scope: "MANA_PRODUCTION",
              evidenceRefs: ["source-1"],
              action: "ADVISORY",
            },
          ],
        };
      },
    },
  });

  try {
    const response = await postJson(relay.port, {
      question: "What should be checked?",
      reasoningPacket: {
        confirmed: ["Approved fact"],
        observed: [],
        planned: [],
        hypotheses: [],
        unknowns: [],
        prohibitedActions: ["No writes"],
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
      text: "Evidence-bound result.",
      claims: [
        {
          text: "A verified claim.",
          scope: "MANA_PRODUCTION",
          evidenceRefs: ["source-1"],
          action: "ADVISORY",
        },
      ],
    });
    assert.equal(seen.length, 1);
    assert.equal(JSON.stringify(relay.liveState()).includes("Approved fact"), false);
  } finally {
    await relay.close();
  }
});

test("local relay fails closed for malformed Deep Analyze input", async () => {
  const relay = await startLocalRelay({
    host: "127.0.0.1",
    port: 0,
    gateway: {
      async analyze() {
        throw new Error("must not be called");
      },
    },
  });

  try {
    const response = await postJson(relay.port, { question: "" });
    assert.equal(response.statusCode, 400);
  } finally {
    await relay.close();
  }
});

test("local relay records only a safe upstream failure class", async () => {
  const logs: unknown[] = [];
  const relay = await startLocalRelay({
    host: "127.0.0.1",
    port: 0,
    logger: {
      info(event, metadata) {
        logs.push({ event, metadata });
      },
    },
    gateway: {
      async analyze() {
        throw Object.assign(new Error("provider body must not be logged"), {
          status: 403,
          code: "model_not_found",
        });
      },
    },
  });

  try {
    const response = await postJson(relay.port, {
      question: "Non-PHI diagnostic question",
      reasoningPacket: {
        confirmed: [], observed: [], planned: [], hypotheses: [], unknowns: [], prohibitedActions: [],
      },
    });

    assert.equal(response.statusCode, 502);
    assert.deepEqual(logs, [
      {
        event: "model.analyze.failed",
        metadata: {
          failureClass: "upstream_access_denied",
          providerCode: "model_not_found",
        },
      },
    ]);
    assert.equal(JSON.stringify(logs).includes("provider body"), false);
  } finally {
    await relay.close();
  }
});

function postJson(port: number, body: unknown): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = request(
      {
        host: "127.0.0.1",
        port,
        path: "/v1/deep-analyze",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
        },
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => { responseBody += chunk; });
        response.on("end", () => resolve({
          statusCode: response.statusCode ?? 0,
          body: responseBody,
        }));
      },
    );
    req.on("error", reject);
    req.end(payload);
  });
}
