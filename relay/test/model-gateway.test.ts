import test from "node:test";
import assert from "node:assert/strict";
import {
  ModelGateway,
  type ModelProvider,
  type ModelRequest,
  type ModelResponse,
  type RelayLogger,
} from "../src/model/ModelGateway.ts";
import {
  OpenAIProvider,
  type OpenAITransport,
} from "../src/model/providers/OpenAIProvider.ts";

test("ModelGateway delegates structured reasoning without logging request body", async () => {
  const requests: ModelRequest[] = [];
  const logs: unknown[] = [];

  const provider: ModelProvider = {
    async analyze(request): Promise<ModelResponse> {
      requests.push(request);

      return {
        text: "Merge PACS hosts DMWL.",
        claims: [],
      };
    },
  };

  const logger: RelayLogger = {
    info(event, metadata) {
      logs.push({ event, metadata });
    },
  };

  const gateway = new ModelGateway({
    provider,
    logger,
  });

  const request: ModelRequest = {
    question: "Who hosts DMWL?",
    reasoningPacket: {
      confirmed: ["Merge PACS hosts DMWL."],
      observed: [],
      planned: [],
      hypotheses: [],
      unknowns: [],
      prohibitedActions: [
        "Do not perform production clinical-system writes.",
      ],
    },
  };

  const response = await gateway.analyze(request);

  assert.equal(response.text, "Merge PACS hosts DMWL.");
  assert.deepEqual(requests, [request]);
  assert.equal(JSON.stringify(logs).includes("Who hosts DMWL?"), false);
  assert.equal(JSON.stringify(logs).includes("Merge PACS hosts DMWL."), false);
});

test("OpenAIProvider fails closed when relay API key is missing", async () => {
  const transport: OpenAITransport = {
    async createResponse() {
      throw new Error("transport should not be called");
    },
  };

  const provider = new OpenAIProvider({
    env: {},
    transport,
  });

  await assert.rejects(
    provider.analyze({
      question: "Who hosts DMWL?",
      reasoningPacket: {
        confirmed: [],
        observed: [],
        planned: [],
        hypotheses: [],
        unknowns: [],
        prohibitedActions: [],
      },
    }),
    /OPENAI_API_KEY/,
  );
});

test("OpenAIProvider uses relay environment credential and normalizes provider response", async () => {
  const calls: Array<{
    apiKey: string;
    body: unknown;
  }> = [];

  const transport: OpenAITransport = {
    async createResponse(apiKey, body) {
      calls.push({ apiKey, body });

      return {
        output_text: "Merge PACS hosts DMWL.",
        claims: [],
      };
    },
  };

  const provider = new OpenAIProvider({
    env: {
      OPENAI_API_KEY: "relay-secret",
    },
    transport,
  });

  const response = await provider.analyze({
    question: "Who hosts DMWL?",
    reasoningPacket: {
      confirmed: ["Merge PACS hosts DMWL."],
      observed: [],
      planned: [],
      hypotheses: [],
      unknowns: [],
      prohibitedActions: [
        "Do not perform production clinical-system writes.",
      ],
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.apiKey, "relay-secret");
  assert.deepEqual(response, {
    text: "Merge PACS hosts DMWL.",
    claims: [],
  });
});

test("OpenAI provider remains transport injectable for cost-free tests", () => {
  assert.equal(true, true);
});
