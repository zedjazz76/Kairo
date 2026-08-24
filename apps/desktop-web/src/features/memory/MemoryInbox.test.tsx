import assert from "node:assert/strict";
import test from "node:test";
import type { ReactElement, ReactNode } from "react";
import type { CoreCommandV1 } from "../../../../../shared/contracts/generated/contracts.v1.ts";
import { MemoryInbox } from "./MemoryInbox.tsx";

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

test("Memory Inbox review preserves the exact candidate id in the Core command", async () => {
  const sent: CoreCommandV1[] = [];
  const inbox = MemoryInbox({
    requestIdForCandidate: (candidateId: string) =>
      candidateId === "memory-2"
        ? "8d4d4668-b359-4a9f-9fc4-9d942c8df75b"
        : "4b528b1c-51bb-4cf3-8e0d-acde8c767f4b",
    candidates: [
      { id: "memory-1", summary: "Merge PACS hosts the current DMWL." },
      { id: "memory-2", summary: "Breast imaging remains on Merge RIS during transition." },
    ],
    onSendCommand: async (command: CoreCommandV1) => {
      sent.push(command);
    },
  } as never) as ReactElement;

  const reviewButtons = findElements(
    inbox,
    (element) => element.type === "button" && element.props.children === "Review",
  );

  assert.equal(reviewButtons.length, 2);
  assert.match(JSON.stringify(inbox), /Merge PACS hosts the current DMWL/);
  assert.match(JSON.stringify(inbox), /Breast imaging remains on Merge RIS during transition/);

  await reviewButtons[1].props.onClick();

  assert.deepEqual(sent, [
    {
      requestId: "8d4d4668-b359-4a9f-9fc4-9d942c8df75b",
      type: "ReviewMemoryCandidate",
      contractVersion: "v1",
      payload: {
        candidateId: "memory-2",
      },
    },
  ]);
});
