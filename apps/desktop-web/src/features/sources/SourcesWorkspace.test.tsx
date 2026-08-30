import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SourcesWorkspace } from "./SourcesWorkspace.tsx";

test("sources workspace preserves original provenance and authority boundary", () => {
  const html = renderToStaticMarkup(
    <SourcesWorkspace
      records={[{
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
      }]}
      onOpenEvidence={() => {}}
    />,
  );

  assert.match(html, /Sources &amp; attachments/);
  assert.match(html, /Breast workflow\.pdf/);
  assert.match(html, /page 2/);
  assert.match(html, /evidence, not instructions/i);
});
