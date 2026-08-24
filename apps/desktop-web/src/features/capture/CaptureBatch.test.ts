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

  assert.deepEqual(batch.commands(), [
    {
      requestId: "d4a31a5c-e4f9-4a73-8958-b4929efad3c7",
      type: "CaptureSource",
      contractVersion: "v1",
      payload: {
        captureSessionId: "capture-1",
        sourceRef: "source-1",
      },
    },
    {
      requestId: "e7612b8a-482b-4cad-994c-09c6194a0846",
      type: "CaptureSource",
      contractVersion: "v1",
      payload: {
        captureSessionId: "capture-1",
        sourceRef: "source-2",
      },
    },
  ]);
});

test("capture batch creates stable UUID request IDs for Core commands", () => {
  const batch = new CaptureBatch({ captureSessionId: "capture-1" });
  batch.stage({
    sourceRef: "source-1",
    name: "meeting-notes.docx",
    sizeBytes: 1_024,
    mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const first = batch.commands();

  assert.match(
    first[0].requestId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  assert.deepEqual(batch.commands(), first);
});
