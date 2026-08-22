import type {
  ModelProvider,
  ModelRequest,
  ModelResponse,
} from "../ModelGateway.js";

export type OpenAIEnvironment = {
  OPENAI_API_KEY?: string;
};

export type OpenAITransportResponse = {
  output_text: string;
  claims?: ModelResponse["claims"];
};

export interface OpenAITransport {
  createResponse(
    apiKey: string,
    body: unknown,
  ): Promise<OpenAITransportResponse>;
}

export type OpenAIProviderOptions = {
  env: OpenAIEnvironment;
  transport: OpenAITransport;
  model?: string;
};

export class OpenAIProvider implements ModelProvider {
  private readonly env: OpenAIEnvironment;
  private readonly transport: OpenAITransport;
  private readonly model: string;

  constructor(options: OpenAIProviderOptions) {
    this.env = options.env;
    this.transport = options.transport;
    this.model = options.model ?? "gpt-5";
  }

  async analyze(
    request: ModelRequest,
  ): Promise<ModelResponse> {
    const apiKey = this.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is required in the relay environment",
      );
    }

    const body = {
      model: this.model,
      input: {
        question: request.question,
        reasoningPacket: request.reasoningPacket,
      },
    };

    const response =
      await this.transport.createResponse(
        apiKey,
        body,
      );

    return {
      text: response.output_text,
      claims: response.claims ?? [],
    };
  }
}
