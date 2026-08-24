import assert from "node:assert/strict";
import test from "node:test";
import type { ReactElement, ReactNode } from "react";
import type { CoreCommandV1 } from "../../../../../shared/contracts/generated/contracts.v1.ts";
import { ProjectsWorkspace } from "./ProjectsWorkspace.tsx";

function findElements(
  node: ReactNode,
  predicate: (element: ReactElement) => boolean,
): ReactElement[] {
  if (!node || typeof node !== "object" || !("props" in node)) return [];

  const element = node as ReactElement;
  const matches = predicate(element) ? [element] : [];
  const children = element.props.children;
  const list = Array.isArray(children) ? children : [children];

  return [
    ...matches,
    ...list.flatMap((child) => findElements(child, predicate)),
  ];
}

test("Projects Open preserves the exact project id in the Core command", async () => {
  const sent: CoreCommandV1[] = [];
  const projects = ProjectsWorkspace({
    requestIdForProject: (projectId: string) =>
      projectId === "project-baxter"
        ? "a63c6a3a-5091-4f6a-98c5-6d6f9760be86"
        : "cf2b9a37-09b5-44cc-a89d-66076ae6e92a",
    projects: [
      { id: "project-kairo", name: "Kairo", summary: "Clinical systems copilot." },
      { id: "project-baxter", name: "Baxter Partner", summary: "Cross-organization imaging workflow." },
    ],
    onSendCommand: async (command: CoreCommandV1) => {
      sent.push(command);
    },
  } as never) as ReactElement;

  const openButtons = findElements(
    projects,
    (element) => element.type === "button" && element.props.children === "Open",
  );

  assert.equal(openButtons.length, 2);
  assert.match(JSON.stringify(projects), /Kairo/);
  assert.match(JSON.stringify(projects), /Baxter Partner/);

  await openButtons[1].props.onClick();

  assert.deepEqual(sent, [
    {
      requestId: "a63c6a3a-5091-4f6a-98c5-6d6f9760be86",
      type: "GetProject",
      contractVersion: "v1",
      payload: {
        projectId: "project-baxter",
      },
    },
  ]);
});
