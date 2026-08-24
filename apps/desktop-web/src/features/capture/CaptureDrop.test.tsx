import assert from "node:assert/strict";
import test from "node:test";
import type { ChangeEvent, ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CaptureBatch } from "./CaptureBatch.ts";
import { CaptureWorkspace } from "./CaptureWorkspace.tsx";

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

test("selected browser files stage metadata in selection order and render immediately", () => {
  const batch = new CaptureBatch({ captureSessionId: "capture-drop" });
  const workspace = CaptureWorkspace({
    captureBatch: batch,
    sourceRefForFile: (_file: File, index: number) => `browser-source-${index + 1}`,
  } as never) as ReactElement;

  const input = findElement(
    workspace,
    (element) => element.type === "input" && element.props.type === "file",
  );
  assert.ok(input, "capture file input should be rendered");
  assert.equal(input.props.multiple, true);
  assert.equal(typeof input.props.onChange, "function");

  const files = [
    {
      name: "meeting-notes.docx",
      size: 1_024,
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      rawBytes: new Uint8Array([1, 2, 3]),
    },
    {
      name: "workflow.png",
      size: 2_048,
      type: "image/png",
      rawBytes: new Uint8Array([4, 5, 6]),
    },
  ] as unknown as File[];

  input.props.onChange({
    currentTarget: { files },
  } as unknown as ChangeEvent<HTMLInputElement>);

  assert.deepEqual(batch.items, [
    {
      sourceRef: "browser-source-1",
      name: "meeting-notes.docx",
      sizeBytes: 1_024,
      mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    {
      sourceRef: "browser-source-2",
      name: "workflow.png",
      sizeBytes: 2_048,
      mediaType: "image/png",
    },
  ]);
  assert.equal("rawBytes" in batch.items[0], false);
  assert.equal("rawBytes" in batch.items[1], false);

  const rerendered = renderToStaticMarkup(
    CaptureWorkspace({ captureBatch: batch } as never),
  );
  assert.match(rerendered, /meeting-notes\.docx/);
  assert.match(rerendered, /workflow\.png/);
  assert.ok(
    rerendered.indexOf("meeting-notes.docx") < rerendered.indexOf("workflow.png"),
    "staged filenames should preserve browser selection order",
  );
});
