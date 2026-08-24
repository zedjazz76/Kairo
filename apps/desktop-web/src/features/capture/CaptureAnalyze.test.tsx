import test from "node:test";
import assert from "node:assert/strict";
import type { ReactElement, ReactNode } from "react";
import type { CoreCommandV1 } from "../../../../../shared/contracts/generated/contracts.v1.ts";
import { CaptureBatch } from "./CaptureBatch.ts";
import { CaptureWorkspace } from "./CaptureWorkspace.tsx";

function findButton(node: ReactNode, label: string): ReactElement | undefined {
  if (!node || typeof node !== "object") return undefined;
  if (!("props" in node)) return undefined;

  const element = node as ReactElement;
  if (element.type === "button" && element.props.children === label) {
    return element;
  }

  const children = element.props.children;
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    const found = findButton(child, label);
    if (found) return found;
  }
  return undefined;
}

test("Analyze together sends staged CaptureSource commands in order", async () => {
  const requestIds = [
    "d4a31a5c-e4f9-4a73-8958-b4929efad3c7",
    "e7612b8a-482b-4cad-994c-09c6194a0846",
  ];
  const batch = new CaptureBatch({
    captureSessionId: "capture-1",
    createRequestId: () => requestIds.shift()!,
  });
  batch.stage({
    sourceRef: "source-1",
    name: "meeting-notes.docx",
    sizeBytes: 1_024,
    mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  batch.stage({
    sourceRef: "source-2",
    name: "workflow.png",
    sizeBytes: 2_048,
    mediaType: "image/png",
  });

  const sent: CoreCommandV1[] = [];
  const workspace = CaptureWorkspace({
    captureBatch: batch,
    onSendCommand: async (command: CoreCommandV1) => {
      sent.push(command);
    },
  } as never) as ReactElement;

  const analyzeButton = findButton(workspace, "Analyze together");
  assert.ok(analyzeButton, "Analyze together button should be rendered");
  assert.equal(typeof analyzeButton.props.onClick, "function");

  await analyzeButton.props.onClick();

  assert.deepEqual(sent, batch.commands());
  assert.deepEqual(sent.map((command) => command.requestId), [
    "d4a31a5c-e4f9-4a73-8958-b4929efad3c7",
    "e7612b8a-482b-4cad-994c-09c6194a0846",
  ]);
});
