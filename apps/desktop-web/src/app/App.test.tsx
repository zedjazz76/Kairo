import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "./App.tsx";
import { DesktopWorkspace } from "./DesktopWorkspace.ts";
import { CaptureBatch } from "../features/capture/CaptureBatch.ts";

function renderDesktop({ evidenceRef }: { evidenceRef?: string } = {}): string {
  const workspace = new DesktopWorkspace();
  if (evidenceRef) {
    workspace.openEvidence(evidenceRef);
  }

  const captureBatch = new CaptureBatch({ captureSessionId: "capture-1" });
  captureBatch.stage({
    sourceRef: "source-1",
    name: "meeting-notes.docx",
    sizeBytes: 1_024,
    mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  return renderToStaticMarkup(
    <App workspace={workspace} captureBatch={captureBatch} />,
  );
}

test("desktop shell renders Capture as primary workspace with persistent Copilot", () => {
  const html = renderDesktop();

  assert.match(html, /data-testid="capture-workspace"/);
  assert.match(html, /meeting-notes\.docx/);
  assert.match(html, /data-testid="copilot-workspace"/);
  assert.match(html, /Ask Kairo/);
  assert.doesNotMatch(html, /data-testid="evidence-pane"/);
});

test("opening evidence preserves Copilot beside the evidence pane", () => {
  const html = renderDesktop({ evidenceRef: "evidence-1" });

  assert.match(html, /data-testid="copilot-workspace"/);
  assert.match(html, /data-testid="evidence-pane"/);
  assert.match(html, /evidence-1/);
});
