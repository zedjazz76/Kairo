import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "./App.tsx";
import { DesktopWorkspace } from "./DesktopWorkspace.ts";
import { CaptureBatch } from "../features/capture/CaptureBatch.ts";

function renderDesktop({ evidenceRef, destination }: { evidenceRef?: string; destination?: "capture" } = {}): string {
  const workspace = new DesktopWorkspace();
  if (destination) {
    workspace.navigate(destination);
  }
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

test("desktop shell renders Intake with persistent Copilot", () => {
  const html = renderDesktop({ destination: "capture" });

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

test("merged home dashboard keeps projects work knowledge sources and Copilot together", () => {
  const html = renderToStaticMarkup(
    App({
      workspace: new DesktopWorkspace(),
      captureBatch: new CaptureBatch({ captureSessionId: "capture-home" }),
      projects: [{ id: "project-abbadox", name: "AbbaDox", summary: "RIS transition" }],
      workItems: [{ id: "WORK-17", title: "Validate PACS route", status: "In Progress", priority: "High" }],
      knowledgeEntries: [{ id: "knowledge-routing", title: "Breast image routing", summary: "Evidence-backed workflow", evidenceState: "OBSERVED" }],
      evidenceRecords: [{
        evidenceRef: "source-workflow",
        sourceId: "source-workflow",
        sourceName: "Breast workflow.pdf",
        sourceType: "DOCUMENT",
        mediaType: "application/pdf",
        origin: "IMPORT",
        classification: "INTERNAL",
        importedAt: "2026-08-29T14:05:00Z",
        contentHash: "sha256:workflow",
        anchorDescription: "page 2",
      }],
    } as never),
  );

  assert.match(html, /data-testid="home-dashboard"/);
  assert.match(html, /Operational focus/);
  assert.match(html, /AbbaDox/);
  assert.match(html, /Validate PACS route/);
  assert.match(html, /Breast image routing/);
  assert.match(html, /Breast workflow\.pdf/);
  assert.match(html, /data-testid="copilot-workspace"/);
});

test("desktop shell injects the active evidence record into the evidence pane", () => {
  const workspace = new DesktopWorkspace();
  workspace.openEvidence("evidence-abbadox-routing");

  const html = renderToStaticMarkup(
    App({
      workspace,
      captureBatch: new CaptureBatch({ captureSessionId: "capture-1" }),
      evidenceRecords: [
        {
          evidenceRef: "evidence-abbadox-routing",
          sourceId: "source-abbadox-meeting",
          sourceName: "AbbaDox routing workshop notes.docx",
          sourceType: "DOCUMENT",
          mediaType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          origin: "IMPORT",
          classification: "CONFIDENTIAL",
          importedAt: "2026-08-23T14:30:00Z",
          contentHash: "sha256:1f4a9c",
          anchorDescription: "Decision section, paragraphs 12–14",
        },
      ],
    } as never),
  );

  assert.match(html, /AbbaDox routing workshop notes\.docx/);
  assert.match(html, /Decision section, paragraphs 12–14/);
});
