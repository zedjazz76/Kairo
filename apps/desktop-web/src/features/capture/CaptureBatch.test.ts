import test from "node:test";
import assert from "node:assert/strict";
import { CaptureBatch } from "./CaptureBatch.ts";

test("capture batch stages metadata without retaining raw file bytes", () => {
  const batch = new CaptureBatch({ captureSessionId: "capture-1" });

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

  assert.deepEqual(batch.items.map((item) => item.name), [
    "meeting-notes.docx",
    "workflow.png",
  ]);
  assert.equal(JSON.stringify(batch.items).includes("bytes"), false);
});

test("capture batch emits typed CaptureSource commands in staged order", () => {
  const batch = new CaptureBatch({ captureSessionId: "capture-1" });

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

  assert.deepEqual(batch.commands(), [
    {
      requestId: "capture-1:1",
      type: "CaptureSource",
      contractVersion: "v1",
      payload: {
        captureSessionId: "capture-1",
        sourceRef: "source-1",
      },
    },
    {
      requestId: "capture-1:2",
      type: "CaptureSource",
      contractVersion: "v1",
      payload: {
        captureSessionId: "capture-1",
        sourceRef: "source-2",
      },
    },
  ]);
});
