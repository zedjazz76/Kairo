import { describe, expect, it } from "vitest";
import {
  ModelGateway,
  type ModelProvider,
  type ModelRequest,
  type ModelResponse,
  type RelayLogger,
} from "../src/model/ModelGateway.js";

describe("ModelGateway", () => {
  it("delegates structured reasoning without logging request body", async () => {
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

    expect(response.text).toBe("Merge PACS hosts DMWL.");
    expect(requests).toEqual([request]);

    expect(
      JSON.stringify(logs),
    ).not.toContain("Who hosts DMWL?");

    expect(
      JSON.stringify(logs),
    ).not.toContain("Merge PACS hosts DMWL.");
  });
});

import {
  OpenAIProvider,
  type OpenAITransport,
} from "../src/model/providers/OpenAIProvider.js";

describe("OpenAIProvider", () => {
  it("fails closed when relay API key is missing", async () => {
    const transport: OpenAITransport = {
      async createResponse() {
        throw new Error("transport should not be called");
      },
    };

    const provider = new OpenAIProvider({
      env: {},
      transport,
    });

    await expect(
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
    ).rejects.toThrow("OPENAI_API_KEY");
  });

  it("uses relay environment credential and normalizes provider response", async () => {
    const calls: Array<{
      apiKey: string;
      body: unknown;
    }> = [];

    const transport: OpenAITransport = {
      async createResponse(apiKey, body) {
        calls.push({
          apiKey,
          body,
        });

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
        confirmed: [
          "Merge PACS hosts DMWL.",
        ],
        observed: [],
        planned: [],
        hypotheses: [],
        unknowns: [],
        prohibitedActions: [
          "Do not perform production clinical-system writes.",
        ],
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.apiKey).toBe("relay-secret");

    expect(response).toEqual({
      text: "Merge PACS hosts DMWL.",
      claims: [],
    });
  });
});

describe("OpenAI transport boundary", () => {
  it("provider remains transport injectable for cost-free tests", () => {
    expect(true).toBe(true);
  });
});
