import assert from "node:assert/strict";
import test from "node:test";
import type { CoreCommandV1 } from "../../../../shared/contracts/generated/contracts.v1.ts";
import {
  PairedTunnelClient,
  createEphemeralKeyPair,
  decryptTunnelFrame,
  deriveSessionKey,
  type EncryptedTunnelFrame,
  type TunnelFrameTransport,
} from "../security/pairedTunnel.ts";
import { composePairedDesktopCommands } from "./PairedDesktopCommands.ts";

const now = 1_725_000_000_000;

class RecordingTransport implements TunnelFrameTransport {
  readonly frames: EncryptedTunnelFrame[] = [];

  async send(frame: EncryptedTunnelFrame): Promise<void> {
    this.frames.push(frame);
  }

  async disconnect(): Promise<void> {}
}

test("paired desktop composition sends every desktop Core command through one encrypted path", async () => {
  const browser = await createEphemeralKeyPair();
  const core = await createEphemeralKeyPair();
  const salt = new Uint8Array(32).fill(21);
  const browserKey = await deriveSessionKey(browser.privateKey, core.publicKey, salt);
  const coreKey = await deriveSessionKey(core.privateKey, browser.publicKey, salt);
  const transport = new RecordingTransport();
  const commandSender = composePairedDesktopCommands(
    new PairedTunnelClient({
      sessionId: "desktop-session-1",
      expiresAt: now + 60_000,
      sessionKey: browserKey,
      transport,
      now: () => now,
    }),
  );
  const commands: CoreCommandV1[] = [
    {
      requestId: "bd449d45-c2fd-433a-8f6e-7b2fe704a524",
      type: "AskKairo",
      contractVersion: "v1",
      payload: { question: "What is the current AbbaDox routing plan?" },
    },
    {
      requestId: "f43f9014-fc8d-495d-a037-736afdb53269",
      type: "DeepAnalyze",
      contractVersion: "v1",
      payload: { question: "Why might studies not reach MagView?" },
    },
    {
      requestId: "76f3ba2e-37c6-4aa1-bc1e-11fb07fc2ba1",
      type: "CaptureSource",
      contractVersion: "v1",
      payload: { captureSessionId: "capture-1", sourceRef: "source-1" },
    },
    {
      requestId: "d7ea584e-9116-4703-9c1e-40f388b7f555",
      type: "ReviewMemoryCandidate",
      contractVersion: "v1",
      payload: { candidateId: "candidate-1" },
    },
    {
      requestId: "46e35bb3-a43e-4914-85bc-c8fd509260db",
      type: "GetProject",
      contractVersion: "v1",
      payload: { projectId: "project-abbadox" },
    },
    {
      requestId: "f0a36846-8b3c-479f-9d52-1b737f57a495",
      type: "OpenEvidence",
      contractVersion: "v1",
      payload: { evidenceRef: "evidence-abbadox-routing" },
    },
  ];

  for (const command of commands) {
    await commandSender.send(command);
  }

  assert.equal(commandSender.connectionState, "CONNECTED");
  assert.equal(JSON.stringify(transport.frames).includes("AbbaDox"), false);
  assert.deepEqual(
    await Promise.all(
      transport.frames.map(async (frame) => JSON.parse(await decryptTunnelFrame(coreKey, frame))),
    ),
    commands,
  );
});

test("unpaired and expired desktop command composition fails closed", async () => {
  const unpaired = composePairedDesktopCommands();
  const command: CoreCommandV1 = {
    requestId: "bd449d45-c2fd-433a-8f6e-7b2fe704a524",
    type: "AskKairo",
    contractVersion: "v1",
    payload: { question: "What is Kairo's state?" },
  };

  assert.equal(unpaired.connectionState, "UNPAIRED");
  await assert.rejects(unpaired.send(command), /tunnel_not_connected/);

  const browser = await createEphemeralKeyPair();
  const core = await createEphemeralKeyPair();
  const expired = composePairedDesktopCommands(
    new PairedTunnelClient({
      sessionId: "expired-session",
      expiresAt: now - 1,
      sessionKey: await deriveSessionKey(
        browser.privateKey,
        core.publicKey,
        new Uint8Array(32).fill(4),
      ),
      transport: new RecordingTransport(),
      now: () => now,
    }),
  );

  await assert.rejects(expired.send(command), /session_expired/);
  assert.equal(expired.connectionState, "EXPIRED");
});
