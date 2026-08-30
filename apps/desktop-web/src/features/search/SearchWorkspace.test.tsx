import assert from "node:assert/strict";
import test from "node:test";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SearchWorkspace,
  createSearchCommand,
  type SearchResultSummary,
} from "./SearchWorkspace.tsx";

function childOfType(node: ReactNode, type: ReactElement["type"]): ReactElement | undefined {
  const children = (node as ReactElement).props.children;
  const list = Array.isArray(children) ? children : [children];
  return list.find((child: ReactElement | null) => child?.type === type);
}

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

test("global search publishes live result references returned by Kairo Core", async () => {
  let published: unknown;
  const workspace = SearchWorkspace({
    createRequestId: () => "81d0bab9-6025-42ef-bf74-7d9793822f78",
    onSendCommand: async () => {},
    onRequestCommand: async () => ({
      requestId: "81d0bab9-6025-42ef-bf74-7d9793822f78",
      type: "SearchKnowledge",
      contractVersion: "v1",
      status: "SUCCESS",
      data: { resultRefs: ["source-routing", "conversation-routing"] },
    }),
    onResults: (results: readonly SearchResultSummary[]) => {
      published = results;
    },
    results: [],
  } as never);
  const form = childOfType(workspace, "form");
  assert.ok(form);

  await form.props.onSubmit({
    preventDefault() {},
    currentTarget: {
      elements: {
        namedItem: () => ({ value: "breast image routing" }),
      },
    },
  });

  assert.deepEqual(published, [
    {
      id: "source-routing",
      kind: "Source",
      title: "source-routing",
      summary: "Returned by Kairo Core",
      evidenceRef: "source-routing",
    },
    {
      id: "conversation-routing",
      kind: "Conversation",
      title: "conversation-routing",
      summary: "Returned by Kairo Core",
      evidenceRef: "conversation-routing",
    },
  ]);
});
