import test from "node:test";
import assert from "node:assert/strict";
import { DesktopWorkspace } from "./DesktopWorkspace.ts";

test("desktop workspace starts on the merged home dashboard and preserves copilot beside evidence review", () => {
  const workspace = new DesktopWorkspace();

  assert.equal(workspace.activeWorkspace, "home");
  assert.equal(workspace.copilotVisible, true);
  assert.equal(workspace.evidencePaneVisible, false);

  workspace.openEvidence("evidence-1");

  assert.equal(workspace.activeEvidenceRef, "evidence-1");
  assert.equal(workspace.evidencePaneVisible, true);
  assert.equal(workspace.copilotVisible, true);
});

test("desktop workspace exposes the website experience and original Kairo destinations", () => {
  const workspace = new DesktopWorkspace();

  assert.deepEqual(workspace.destinations, [
    "home",
    "knowledge",
    "projects",
    "work",
    "sources",
    "capture",
    "search",
    "copilot",
    "memory",
  ]);

  workspace.navigate("projects");
  assert.equal(workspace.activeWorkspace, "projects");
});

test("desktop workspace retains live Core search results across navigation", () => {
  const workspace = new DesktopWorkspace();
  const results = [
    {
      id: "conversation-routing",
      kind: "Conversation" as const,
      title: "conversation-routing",
      summary: "Returned by Kairo Core",
      evidenceRef: "conversation-routing",
    },
  ];

  workspace.replaceSearchResults(results);
  workspace.navigate("home");
  workspace.navigate("search");

  assert.equal(workspace.hasLiveSearchResults, true);
  assert.deepEqual(workspace.searchResults, results);
});
