import test from "node:test";
import assert from "node:assert/strict";
import type { FormEvent, ReactElement, ReactNode } from "react";
import type { CoreCommandV1 } from "../../../../../shared/contracts/generated/contracts.v1.ts";
import { CopilotWorkspace } from "./CopilotWorkspace.tsx";

function findElement(
  node: ReactNode,
  predicate: (element: ReactElement) => boolean,
): ReactElement | undefined {
  if (!node || typeof node !== "object" || !("props" in node)) return undefined;

  const element = node as ReactElement;
  if (predicate(element)) return element;

  const children = element.props.children;
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return undefined;
}

test("Ask Kairo sends the entered question as a typed Core command", async () => {
  const sent: CoreCommandV1[] = [];
  const workspace = CopilotWorkspace({
    requestId: "b65f163c-d6d5-4ee7-9e29-73c0edb4e612",
    onSendCommand: async (command: CoreCommandV1) => {
      sent.push(command);
    },
  } as never) as ReactElement;

  const form = findElement(workspace, (element) => element.type === "form");
  assert.ok(form, "Ask Kairo form should be rendered");
  assert.equal(typeof form.props.onSubmit, "function");

  const fakeEvent = {
    preventDefault() {},
    currentTarget: {
      elements: {
        namedItem(name: string) {
          return name === "question"
            ? { value: "Who hosts the DICOM worklist?" }
            : null;
        },
      },
    },
  } as unknown as FormEvent<HTMLFormElement>;

  await form.props.onSubmit(fakeEvent);

  assert.deepEqual(sent, [
    {
      requestId: "b65f163c-d6d5-4ee7-9e29-73c0edb4e612",
      type: "AskKairo",
      contractVersion: "v1",
      payload: {
        question: "Who hosts the DICOM worklist?",
      },
    },
  ]);
});
