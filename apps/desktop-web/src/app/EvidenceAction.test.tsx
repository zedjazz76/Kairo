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

test("Open evidence action preserves Copilot and opens the matching evidence pane", () => {
  const workspace = new DesktopWorkspace();
  const captureBatch = createCaptureBatch();

  const app = App({ workspace, captureBatch }) as ReactElement;
  const children = Array.isArray(app.props.children)
    ? app.props.children
    : [app.props.children];
  const copilot = children.find(
    (child: ReactElement | null) => child?.type === CopilotWorkspace,
  ) as ReactElement | undefined;

  assert.ok(copilot, "Copilot workspace should be rendered");
  assert.equal(typeof copilot.props.onOpenEvidence, "function");

  copilot.props.onOpenEvidence("evidence-1");

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
