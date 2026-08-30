import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SearchWorkspace, createSearchCommand } from "./SearchWorkspace.tsx";

test("global search routes through the authoritative Kairo Core command", () => {
  assert.deepEqual(createSearchCommand("breast image routing", "request-search-1"), {
    requestId: "request-search-1",
    type: "SearchKnowledge",
    contractVersion: "v1",
    payload: { query: "breast image routing" },
  });
});

test("global search renders grouped Core-backed results", () => {
  const html = renderToStaticMarkup(
    <SearchWorkspace
      createRequestId={() => "request-search-1"}
      onSendCommand={async () => {}}
      results={[
        { id: "knowledge-routing", kind: "Knowledge", title: "Breast image routing", summary: "Observed PACS to MagView flow" },
        { id: "source-workflow", kind: "Source", title: "Breast workflow.pdf", summary: "Page 2" },
      ]}
    />,
  );

  assert.match(html, /Search all of Kairo/);
  assert.match(html, /Breast image routing/);
  assert.match(html, /Breast workflow\.pdf/);
});
