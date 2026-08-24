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

test("Deep Analyze sends the current question as a dedicated Core command", async () => {
  const sent: CoreCommandV1[] = [];
  const workspace = CopilotWorkspace({
    requestId: "9d7b49bc-344b-4e8d-8ec2-cc2d55650f7f",
    onSendCommand: async (command: CoreCommandV1) => {
      sent.push(command);
    },
  }) as ReactElement;

  const form = findElement(workspace, (element) => element.type === "form");
  assert.ok(form, "Copilot question form should be rendered");

  const deepButton = findElement(
    workspace,
    (element) => element.type === "button" && element.props.children === "Deep Analyze",
  );
  assert.ok(deepButton, "Deep Analyze button should be rendered");
  assert.equal(typeof deepButton.props.onClick, "function");

  const fakeForm = {
    elements: {
      namedItem(name: string) {
        return name === "question"
          ? { value: "Why are studies not reaching MagView?" }
          : null;
      },
    },
  };

  await deepButton.props.onClick({
    preventDefault() {},
    currentTarget: {
      form: fakeForm,
    },
  } as unknown as FormEvent<HTMLButtonElement>);

  assert.deepEqual(sent, [
    {
      requestId: "9d7b49bc-344b-4e8d-8ec2-cc2d55650f7f",
      type: "DeepAnalyze",
      contractVersion: "v1",
      payload: {
        question: "Why are studies not reaching MagView?",
      },
    },
  ]);
});
