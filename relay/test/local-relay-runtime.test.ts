import assert from "node:assert/strict";
import { request } from "node:http";
import test from "node:test";
import { startLocalRelay } from "../src/runtime/LocalRelayRuntime.ts";
import { TunnelBroker, type TunnelFrame } from "../src/tunnel/TunnelBroker.ts";
import { TunnelExchangeBroker } from "../src/tunnel/TunnelExchangeBroker.ts";

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

test("local relay carries one paired encrypted command and correlated result without retaining either", async () => {
  const now = 1_725_000_000_000;
  const expiresAt = now + 60_000;
  const sessions = new TunnelBroker({ now: () => now });
  sessions.openSession({ sessionId: "paired-session", expiresAt });
  const tunnelExchange = new TunnelExchangeBroker({ sessions, timeoutMs: 1_000 });
  const relay = await startLocalRelay({
    host: "127.0.0.1",
    port: 0,
    gateway: { async analyze() { throw new Error("unused"); } },
    tunnelExchange,
  });
  const command: TunnelFrame = {
    sessionId: "paired-session",
    sequence: 1,
    expiresAt,
    nonce: "AAAAAAAAAAAAAAAA",
    ciphertext: "encrypted-command",
  };
  const result: TunnelFrame = {
    ...command,
    ciphertext: "encrypted-result",
  };

  try {
    const browserResponse = requestJson(
      relay.port,
      "POST",
      "/v1/tunnel/paired-session/requests",
      command,
    );
    await Promise.resolve();

    const androidCommand = await requestJson(
      relay.port,
      "GET",
      "/v1/tunnel/paired-session/commands",
    );
    assert.equal(androidCommand.statusCode, 200);
    assert.deepEqual(JSON.parse(androidCommand.body), command);

    const accepted = await requestJson(
      relay.port,
      "POST",
      "/v1/tunnel/paired-session/responses/1",
      result,
    );
    assert.equal(accepted.statusCode, 204);

    assert.deepEqual(JSON.parse((await browserResponse).body), result);
    assert.deepEqual(tunnelExchange.liveState(), {
      queuedCommands: 0,
      pendingResponses: 0,
    });
  } finally {
    await relay.close();
  }
});

function postJson(port: number, body: unknown): Promise<{ statusCode: number; body: string }> {
  return requestJson(port, "POST", "/v1/deep-analyze", body);
}

function requestJson(
  port: number,
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const req = request(
      {
        host: "127.0.0.1",
        port,
        path,
        method,
        headers: payload.length === 0 ? undefined : {
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
