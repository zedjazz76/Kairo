import type {
  CoreCommandV1,
  CoreResultV1,
} from "../../../../shared/contracts/generated/contracts.v1.ts";
import type { PairedTunnelClient } from "../security/pairedTunnel.ts";

export type DesktopConnectionState =
  | "UNPAIRED"
  | "CONNECTED"
  | "DISCONNECTED"
  | "EXPIRED";

export type DesktopCommandSender = {
  readonly connectionState: DesktopConnectionState;
  send(command: CoreCommandV1): Promise<void>;
  request(command: CoreCommandV1): Promise<CoreResultV1>;
  disconnect(): Promise<void>;
};

type PairedTunnelCommandClient = Pick<
  PairedTunnelClient,
  "sendCommand" | "requestPlaintext" | "disconnect"
>;

export function composePairedDesktopCommands(
  tunnel?: PairedTunnelCommandClient,
): DesktopCommandSender {
  let connectionState: DesktopConnectionState = tunnel ? "CONNECTED" : "UNPAIRED";

  return {
    get connectionState(): DesktopConnectionState {
      return connectionState;
    },

    async send(command: CoreCommandV1): Promise<void> {
      if (!tunnel || connectionState !== "CONNECTED") {
        throw new Error(
          connectionState === "EXPIRED" ? "session_expired" : "tunnel_not_connected",
        );
      }

      try {
        await tunnel.sendCommand(command);
      } catch (error) {
        connectionState = error instanceof Error && error.message === "session_expired"
          ? "EXPIRED"
          : "DISCONNECTED";
        throw error;
      }
    },

    async request(command: CoreCommandV1): Promise<CoreResultV1> {
      if (!tunnel || connectionState !== "CONNECTED") {
        throw new Error(
          connectionState === "EXPIRED" ? "session_expired" : "tunnel_not_connected",
        );
      }

      try {
        const plaintext = await tunnel.requestPlaintext(JSON.stringify(command));
        return parseCoreResult(plaintext, command);
      } catch (error) {
        connectionState = error instanceof Error && error.message === "session_expired"
          ? "EXPIRED"
          : "DISCONNECTED";
        throw error;
      }
    },

    async disconnect(): Promise<void> {
      if (!tunnel || connectionState !== "CONNECTED") {
        return;
      }

      connectionState = "DISCONNECTED";
      await tunnel.disconnect();
    },
  };
}

function parseCoreResult(
  plaintext: string,
  command: CoreCommandV1,
): CoreResultV1 {
  let value: unknown;
  try {
    value = JSON.parse(plaintext);
  } catch {
    throw new Error("invalid_core_result");
  }

  if (!isRecord(value)) {
    throw new Error("invalid_core_result");
  }

  if (value.requestId !== command.requestId || value.type !== command.type) {
    throw new Error("core_result_request_mismatch");
  }

  if (value.contractVersion !== "v1") {
    throw new Error("invalid_core_result");
  }

  if (value.status === "ERROR") {
    if (
      "data" in value ||
      !isRecord(value.error) ||
      !["INVALID_REQUEST", "NOT_FOUND", "UNAVAILABLE", "INTERNAL"].includes(
        String(value.error.code),
      )
    ) {
      throw new Error("invalid_core_result");
    }
    return value as unknown as CoreResultV1;
  }

  if (value.status !== "SUCCESS" || "error" in value || !isRecord(value.data)) {
    throw new Error("invalid_core_result");
  }

  const data = value.data;
  const valid = command.type === "SearchKnowledge"
    ? Array.isArray(data.resultRefs) && data.resultRefs.every(nonEmptyString)
    : command.type === "CaptureSource"
      ? nonEmptyString(data.captureSessionId)
      : command.type === "GetSystem"
        ? nonEmptyString(data.systemRef)
        : command.type === "TraceWorkflow"
          ? nonEmptyString(data.traceRef)
          : command.type === "GetProject"
            ? nonEmptyString(data.projectRef)
            : command.type === "ReviewMemoryCandidate"
              ? nonEmptyString(data.reviewRef)
              : command.type === "OpenEvidence"
                ? nonEmptyString(data.evidenceRef)
                : nonEmptyString(data.answerRef);

  if (!valid) {
    throw new Error("invalid_core_result");
  }

  return value as unknown as CoreResultV1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
