import test from "node:test";
import assert from "node:assert/strict";
import { DesktopWorkspace } from "./DesktopWorkspace.ts";

test("desktop workspace starts in capture and preserves copilot beside evidence review", () => {
  const workspace = new DesktopWorkspace();

  assert.equal(workspace.activeWorkspace, "capture");
  assert.equal(workspace.copilotVisible, true);
  assert.equal(workspace.evidencePaneVisible, false);

  workspace.openEvidence("evidence-1");

  assert.equal(workspace.activeEvidenceRef, "evidence-1");
  assert.equal(workspace.evidencePaneVisible, true);
  assert.equal(workspace.copilotVisible, true);
});

test("desktop workspace exposes the approved Task 13 destinations", () => {
  const workspace = new DesktopWorkspace();

  assert.deepEqual(workspace.destinations, [
    "capture",
    "copilot",
    "memory",
    "projects",
  ]);

  workspace.navigate("projects");
  assert.equal(workspace.activeWorkspace, "projects");
});
