import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EvidencePane } from "./EvidencePane.tsx";

test("evidence inspection resolves the active reference to source provenance metadata", () => {
  const html = renderToStaticMarkup(
    EvidencePane({
      evidenceRef: "evidence-abbadox-routing",
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

  assert.match(html, /evidence-abbadox-routing/);
  assert.match(html, /AbbaDox routing workshop notes\.docx/);
  assert.match(html, /DOCUMENT/);
  assert.match(
    html,
    /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/,
  );
  assert.match(html, /IMPORT/);
  assert.match(html, /CONFIDENTIAL/);
  assert.match(html, /2026-08-23T14:30:00Z/);
  assert.match(html, /sha256:1f4a9c/);
  assert.match(html, /Decision section, paragraphs 12–14/);
  assert.doesNotMatch(html, /raw source content/i);
});
