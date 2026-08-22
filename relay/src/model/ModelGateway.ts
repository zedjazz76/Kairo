export type ReasoningPacketPayload = {
  confirmed: string[];
  observed: string[];
  planned: string[];
  hypotheses: string[];
  unknowns: string[];
  prohibitedActions: string[];
};

export type ModelRequest = {
  question: string;
  reasoningPacket: ReasoningPacketPayload;
};

export type ModelClaim = {
  text: string;
  scope?: string;
  evidenceRefs?: string[];
  action?: string;
};

export type ModelResponse = {
  text: string;
  claims: ModelClaim[];
};

export interface ModelProvider {
  analyze(request: ModelRequest): Promise<ModelResponse>;
}

export interface RelayLogger {
  info(
    event: string,
    metadata?: Record<string, unknown>,
  ): void;
}

export type ModelGatewayOptions = {
  provider: ModelProvider;
  logger?: RelayLogger;
};

export class ModelGateway {
  private readonly provider: ModelProvider;
  private readonly logger?: RelayLogger;

  constructor(options: ModelGatewayOptions) {
    this.provider = options.provider;
    this.logger = options.logger;
  }

  async analyze(
    request: ModelRequest,
  ): Promise<ModelResponse> {
    this.logger?.info(
      "model.analyze.started",
      {
        confirmedCount:
          request.reasoningPacket.confirmed.length,
        observedCount:
          request.reasoningPacket.observed.length,
        plannedCount:
          request.reasoningPacket.planned.length,
        hypothesisCount:
          request.reasoningPacket.hypotheses.length,
        unknownCount:
          request.reasoningPacket.unknowns.length,
        prohibitedActionCount:
          request.reasoningPacket.prohibitedActions.length,
      },
    );

    const response =
      await this.provider.analyze(request);

    this.logger?.info(
      "model.analyze.completed",
      {
        claimCount: response.claims.length,
      },
    );

    return response;
  }
}
