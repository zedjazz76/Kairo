import OpenAI from "openai";
import type {
  OpenAITransport,
  OpenAITransportResponse,
} from "./OpenAIProvider.js";

export class OpenAIResponsesTransport
  implements OpenAITransport {

  async createResponse(
    apiKey: string,
    body: unknown,
  ): Promise<OpenAITransportResponse> {
    const request =
      body as {
        model: string;
        input: {
          question: string;
          reasoningPacket: unknown;
        };
      };

    const client = new OpenAI({
      apiKey,
      logLevel: "error",
    });

    const response =
      await client.responses.create({
        model: request.model,
        store: false,
        instructions: [
          "You are Kairo, an evidence-bound clinical systems reasoning engine.",
          "Use only the supplied evidence when making MANA-specific claims.",
          "Keep confirmed, observed, planned, hypothetical, and unknown information distinct.",
          "Do not recommend or perform production clinical-system writes.",
          "Return JSON only with this shape:",
          '{"text":"string","claims":[{"text":"string","scope":"string","evidenceRefs":["string"],"action":"NONE|ADVISORY|PRODUCTION_WRITE"}]}',
        ].join("\n"),
        input: JSON.stringify({
          question: request.input.question,
          evidence: request.input.reasoningPacket,
        }),
      });

    const text =
      response.output_text.trim();

    if (!text) {
      throw new Error(
        "OpenAI Responses API returned no text output",
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(
        "OpenAI Responses API returned invalid Kairo JSON",
      );
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("text" in parsed) ||
      typeof parsed.text !== "string"
    ) {
      throw new Error(
        "OpenAI Responses API returned invalid Kairo response shape",
      );
    }

    const claims =
      "claims" in parsed &&
      Array.isArray(parsed.claims)
        ? parsed.claims
        : [];

    return {
      output_text: parsed.text,
      claims,
    };
  }
}
