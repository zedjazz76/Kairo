import test from "node:test";
import assert from "node:assert/strict";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "./App.tsx";
import { DesktopWorkspace } from "./DesktopWorkspace.ts";
import { CaptureBatch } from "../features/capture/CaptureBatch.ts";
import { CopilotWorkspace } from "../features/copilot/CopilotWorkspace.tsx";

function createCaptureBatch(): CaptureBatch {
  return new CaptureBatch({ captureSessionId: "capture-1" });
}

test("Open evidence sends the typed command before preserving Copilot beside the matching pane", async () => {
  const workspace = new DesktopWorkspace();
  const captureBatch = createCaptureBatch();
  const sent: CoreCommandV1[] = [];

  const app = App({
    workspace,
    captureBatch,
    commandSender: {
      connectionState: "CONNECTED",
      send: async (command: CoreCommandV1) => {
        sent.push(command);
      },
      disconnect: async () => {},
    },
    createRequestId: () => "f0a36846-8b3c-479f-9d52-1b737f57a495",
  } as never) as ReactElement;
  const children = Array.isArray(app.props.children)
    ? app.props.children
    : [app.props.children];
  const copilot = children.find(
    (child: ReactElement | null) => child?.type === CopilotWorkspace,
  ) as ReactElement | undefined;

  assert.ok(copilot, "Copilot workspace should be rendered");
  assert.equal(typeof copilot.props.onOpenEvidence, "function");

  await copilot.props.onOpenEvidence("evidence-1");

  assert.deepEqual(sent, [
    {
      requestId: "f0a36846-8b3c-479f-9d52-1b737f57a495",
      type: "OpenEvidence",
      contractVersion: "v1",
      payload: { evidenceRef: "evidence-1" },
    },
  ]);

  assert.equal(workspace.activeEvidenceRef, "evidence-1");
  assert.equal(workspace.evidencePaneVisible, true);
  assert.equal(workspace.copilotVisible, true);

  const html = renderToStaticMarkup(
    <App workspace={workspace} captureBatch={captureBatch} />,
  );

  assert.match(html, /data-testid="copilot-workspace"/);
  assert.match(html, /data-testid="evidence-pane"/);
  assert.match(html, /evidence-1/);
});
