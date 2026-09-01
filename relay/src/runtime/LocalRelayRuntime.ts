import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  ModelGateway,
  type ModelRequest,
  type ModelResponse,
  type RelayLogger,
} from "../model/ModelGateway.ts";
import type { TunnelFrame } from "../tunnel/TunnelBroker.ts";
import type { TunnelExchangeBroker } from "../tunnel/TunnelExchangeBroker.ts";

const maxRequestBytes = 128 * 1024;
const packetFields = [
  "confirmed",
  "observed",
  "planned",
  "hypotheses",
  "unknowns",
  "prohibitedActions",
] as const;

type Gateway = Pick<ModelGateway, "analyze">;

export type LocalRelayOptions = {
  host?: "127.0.0.1";
  port?: number;
  gateway?: Gateway;
  logger?: RelayLogger;
  tunnelExchange?: TunnelExchangeBroker;
};

export type LocalRelay = {
  port: number;
  close(): Promise<void>;
  liveState(): { inFlight: number };
};

export async function startLocalRelay(
  options: LocalRelayOptions = {},
): Promise<LocalRelay> {
  const host = options.host ?? "127.0.0.1";
  const gateway = options.gateway ?? await createDefaultGateway();
  let inFlight = 0;

  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/healthz") {
      writeJson(response, 200, { status: "ok" });
      return;
    }

    if (options.tunnelExchange && await handleTunnelRequest(
      request,
      response,
      options.tunnelExchange,
    )) {
      return;
    }

    if (request.method !== "POST" || request.url !== "/v1/deep-analyze") {
      writeJson(response, 404, { error: "not_found" });
      return;
    }

    let parsed: ModelRequest;
    try {
      parsed = parseModelRequest(await readBody(request));
    } catch {
      writeJson(response, 400, { error: "invalid_request" });
      return;
    }

    inFlight += 1;
    try {
      const result = await gateway.analyze(parsed);
      writeJson(response, 200, result);
    } catch (error) {
      options.logger?.info("model.analyze.failed", {
        failureClass: classifyReasoningFailure(error),
        ...safeProviderCode(error),
      });
      writeJson(response, 502, { error: "reasoning_unavailable" });
    } finally {
      inFlight -= 1;
    }
  });

  await listen(server, host, options.port ?? 8787);
  const address = server.address() as AddressInfo;

  return {
    port: address.port,
    close: () => close(server),
    liveState: () => ({ inFlight }),
  };
}

async function handleTunnelRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  exchange: TunnelExchangeBroker,
): Promise<boolean> {
  const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "v1" || segments[1] !== "tunnel") {
    return false;
  }

  const sessionId = segments[2];
  if (!sessionId || !/^[A-Za-z0-9._-]{1,128}$/.test(sessionId)) {
    writeJson(response, 400, { error: "invalid_request" });
    return true;
  }

  try {
    if (
      request.method === "POST" &&
      segments.length === 4 &&
      segments[3] === "requests"
    ) {
      const command = parseTunnelFrame(await readBody(request), sessionId);
      writeJson(response, 200, await exchange.request(command));
      return true;
    }

    if (
      request.method === "GET" &&
      segments.length === 4 &&
      segments[3] === "commands"
    ) {
      const command = exchange.takeCommand(sessionId);
      if (command === null) {
        writeEmpty(response, 204);
      } else {
        writeJson(response, 200, command);
      }
      return true;
    }

    if (
      request.method === "POST" &&
      segments.length === 5 &&
      segments[3] === "responses"
    ) {
      const requestSequence = Number(segments[4]);
      if (!Number.isSafeInteger(requestSequence) || requestSequence <= 0) {
        throw new Error("invalid_request");
      }
      await exchange.respond({
        sessionId,
        requestSequence,
        frame: parseTunnelFrame(await readBody(request), sessionId),
      });
      writeEmpty(response, 204);
      return true;
    }

    if (request.method === "DELETE" && segments.length === 3) {
      exchange.closeSession(sessionId);
      writeEmpty(response, 204);
      return true;
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_request";
    const status = code === "tunnel_response_timeout"
      ? 504
      : code === "session_expired"
        ? 410
        : 400;
    writeJson(response, status, { error: code });
    return true;
  }

  writeJson(response, 404, { error: "not_found" });
  return true;
}

function parseTunnelFrame(value: string, expectedSessionId: string): TunnelFrame {
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("invalid_request");
  }
  const frame = parsed as Record<string, unknown>;
  if (
    frame.sessionId !== expectedSessionId ||
    !Number.isSafeInteger(frame.sequence) ||
    (frame.sequence as number) <= 0 ||
    !Number.isSafeInteger(frame.expiresAt) ||
    (frame.expiresAt as number) <= 0 ||
    typeof frame.nonce !== "string" ||
    frame.nonce.length === 0 ||
    typeof frame.ciphertext !== "string" ||
    frame.ciphertext.length === 0
  ) {
    throw new Error("invalid_request");
  }
  return frame as TunnelFrame;
}

async function createDefaultGateway(): Promise<Gateway> {
  const [{ OpenAIProvider }, { OpenAIResponsesTransport }] = await Promise.all([
    import("../model/providers/OpenAIProvider.ts"),
    import("../model/providers/OpenAIResponsesTransport.ts"),
  ]);
  return new ModelGateway({
    provider: new OpenAIProvider({
      env: process.env,
      transport: new OpenAIResponsesTransport(),
    }),
  });
}

function safeProviderCode(error: unknown): Record<string, string> {
  if (typeof error !== "object" || error === null) {
    return {};
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^[a-z_]{1,64}$/.test(code)
    ? { providerCode: code }
    : {};
}

function classifyReasoningFailure(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "upstream_unavailable";
  }

  const candidate = error as { status?: unknown; code?: unknown };
  if (candidate.status === 401 || candidate.code === "invalid_api_key") {
    return "upstream_authentication_failed";
  }
  if (candidate.status === 403 || candidate.code === "model_not_found") {
    return "upstream_access_denied";
  }
  if (candidate.status === 400) {
    return "upstream_invalid_request";
  }
  if (candidate.status === 429) {
    return "upstream_rate_or_quota_limited";
  }
  return "upstream_unavailable";
}

function parseModelRequest(value: string): ModelRequest {
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Request must be an object");
  }

  const candidate = parsed as Record<string, unknown>;
  if (
    typeof candidate.question !== "string" ||
    candidate.question.trim().length === 0 ||
    candidate.question.length > 4_000 ||
    typeof candidate.reasoningPacket !== "object" ||
    candidate.reasoningPacket === null
  ) {
    throw new Error("Request must contain a bounded question and reasoning packet");
  }

  const packet = candidate.reasoningPacket as Record<string, unknown>;
  const normalized = Object.fromEntries(
    packetFields.map((field) => [field, parseStringList(packet[field])]),
  ) as ModelRequest["reasoningPacket"];

  return {
    question: candidate.question.trim(),
    reasoningPacket: normalized,
  };
}

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 100) {
    throw new Error("Reasoning packet field must be a bounded list");
  }

  return value.map((entry) => {
    if (typeof entry !== "string" || entry.length > 8_000) {
      throw new Error("Reasoning packet entries must be bounded strings");
    }
    return entry;
  });
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      size += Buffer.byteLength(chunk);
      if (size > maxRequestBytes) {
        reject(new Error("Request body exceeds limit"));
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function writeJson(
  response: import("node:http").ServerResponse,
  status: number,
  body: ModelResponse | TunnelFrame | { status: string } | { error: string },
): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function writeEmpty(
  response: import("node:http").ServerResponse,
  status: number,
): void {
  response.writeHead(status);
  response.end();
}

function listen(server: Server, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
