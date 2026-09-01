import assert from "node:assert/strict";
import test from "node:test";
import { RelayTunnelFrameTransport } from "./RelayTunnelFrameTransport.ts";
import type { EncryptedTunnelFrame } from "./pairedTunnel.ts";

test("relay transport requests a correlated encrypted result and disconnects its paired session", async () => {
  const command: EncryptedTunnelFrame = {
    sessionId: "paired-session",
    sequence: 1,
    expiresAt: 1_725_000_060_000,
    nonce: "AAAAAAAAAAAAAAAA",
    ciphertext: "encrypted-command",
  };
  const result: EncryptedTunnelFrame = {
    ...command,
    ciphertext: "encrypted-result",
  };
  const calls: Array<{ url: string; method: string; body: string | null }> = [];
  const transport = new RelayTunnelFrameTransport({
    relayUrl: "http://127.0.0.1:8787/",
    sessionId: "paired-session",
    fetch: async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : null,
      });
      if (init?.method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      return Response.json(result);
    },
  });

  assert.deepEqual(await transport.request(command), result);
  await transport.disconnect();

  assert.deepEqual(calls, [
    {
      url: "http://127.0.0.1:8787/v1/tunnel/paired-session/requests",
      method: "POST",
      body: JSON.stringify(command),
    },
    {
      url: "http://127.0.0.1:8787/v1/tunnel/paired-session",
      method: "DELETE",
      body: null,
    },
  ]);
});
