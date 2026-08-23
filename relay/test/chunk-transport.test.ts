import test from "node:test";
import assert from "node:assert/strict";
import {
  chunkPayload,
  reassembleChunks,
} from "../src/tunnel/ChunkTransport.ts";

const encoder = new TextEncoder();

test("payloads are split into bounded ordered chunks and reassemble exactly", () => {
  const payload = "Kairo secure tunnel payload with enough content to span several chunks.";
  const chunks = chunkPayload({
    messageId: "message-1",
    payload,
    maxChunkBytes: 16,
  });

  assert.ok(chunks.length > 1);
  assert.equal(chunks.every((chunk) => encoder.encode(chunk.payload).byteLength <= 16), true);
  assert.deepEqual(
    chunks.map((chunk) => chunk.index),
    Array.from({ length: chunks.length }, (_, index) => index),
  );
  assert.equal(chunks.every((chunk) => chunk.total === chunks.length), true);

  assert.equal(reassembleChunks([...chunks].reverse()), payload);
});

test("reassembly rejects incomplete or duplicate chunk sets", () => {
  const chunks = chunkPayload({
    messageId: "message-1",
    payload: "0123456789abcdefghijklmnopqrstuvwxyz",
    maxChunkBytes: 8,
  });

  assert.throws(
    () => reassembleChunks(chunks.slice(1)),
    /chunk_set_incomplete/,
  );

  assert.throws(
    () => reassembleChunks([...chunks, chunks[0]]),
    /chunk_duplicate/,
  );
});
