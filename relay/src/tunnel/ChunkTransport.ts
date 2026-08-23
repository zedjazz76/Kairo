export interface TunnelChunk {
  messageId: string;
  index: number;
  total: number;
  payload: string;
}

const encoder = new TextEncoder();

export function chunkPayload(input: {
  messageId: string;
  payload: string;
  maxChunkBytes: number;
}): TunnelChunk[] {
  if (!Number.isInteger(input.maxChunkBytes) || input.maxChunkBytes <= 0) {
    throw new Error("invalid_chunk_size");
  }

  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;

  for (const character of input.payload) {
    const characterBytes = encoder.encode(character).byteLength;
    if (characterBytes > input.maxChunkBytes) {
      throw new Error("chunk_character_too_large");
    }

    if (currentBytes + characterBytes > input.maxChunkBytes && current.length > 0) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }

    current += character;
    currentBytes += characterBytes;
  }

  if (current.length > 0 || parts.length === 0) {
    parts.push(current);
  }

  const total = parts.length;
  return parts.map((payload, index) => ({
    messageId: input.messageId,
    index,
    total,
    payload,
  }));
}

export function reassembleChunks(chunks: readonly TunnelChunk[]): string {
  if (chunks.length === 0) {
    throw new Error("chunk_set_incomplete");
  }

  const messageId = chunks[0].messageId;
  const total = chunks[0].total;

  if (!Number.isInteger(total) || total <= 0) {
    throw new Error("chunk_set_incomplete");
  }

  const byIndex = new Map<number, TunnelChunk>();

  for (const chunk of chunks) {
    if (chunk.messageId !== messageId || chunk.total !== total) {
      throw new Error("chunk_set_mismatch");
    }

    if (!Number.isInteger(chunk.index) || chunk.index < 0 || chunk.index >= total) {
      throw new Error("chunk_set_incomplete");
    }

    if (byIndex.has(chunk.index)) {
      throw new Error("chunk_duplicate");
    }

    byIndex.set(chunk.index, chunk);
  }

  if (byIndex.size !== total) {
    throw new Error("chunk_set_incomplete");
  }

  const ordered: string[] = [];
  for (let index = 0; index < total; index += 1) {
    const chunk = byIndex.get(index);
    if (!chunk) {
      throw new Error("chunk_set_incomplete");
    }
    ordered.push(chunk.payload);
  }

  return ordered.join("");
}
