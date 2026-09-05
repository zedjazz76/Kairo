export const MAX_FILE_BYTES = 104857600;

function throwIfCanceled(signal) {
  if (signal?.aborted) throw new DOMException('Catalog canceled', 'AbortError');
}

function byteLength(source) {
  return /[^\x00-\x7f]/.test(source) ? new TextEncoder().encode(source).byteLength : source.length;
}

function* scanMessageBoundaries(source) {
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf('MSH', cursor);
    if (start < 0) break;
    cursor = start + 3;
    const field = source[start + 3];
    if (!field || /[A-Za-z0-9\s]/.test(field) || source.length < start + 8) continue;
    let lineStart = start;
    while (lineStart > 0 && start - lineStart <= 512 && !'\r\n\u000b'.includes(source[lineStart - 1])) lineStart -= 1;
    const prefix = source.slice(lineStart, start);
    if (prefix.length > 512 || /^[A-Z0-9]{3}[^A-Za-z0-9\s]/.test(prefix)) continue;
    const framed = source[lineStart - 1] === '\u000b';
    const frameEnd = framed ? source.indexOf('\u001c', start) : -1;
    yield { start, lineStart, prefix, framing: framed ? 'MLLP' : 'unframed', frameEnd };
  }
}

function readCatalogMetadata(source, boundary, end, index) {
  let text = source.slice(boundary.start, end);
  const footer = /(?:\r\n|\r|\n)(?:BTS|FTS)[^A-Za-z0-9\s]/.exec(text);
  if (footer) text = text.slice(0, footer.index + (text[footer.index] === '\r' && text[footer.index + 1] === '\n' ? 2 : 1));
  const header = text.split(/\r\n|\r|\n/, 1)[0];
  const field = header[3];
  const fields = header.split(field);
  const type = fields[8] || '';
  const component = header[4];
  return {
    id: `message-${index + 1}`,
    index,
    start: boundary.start,
    end: boundary.start + text.length,
    text,
    type,
    family: type.split(component)[0],
    controlId: fields[9] || '',
    version: fields[11] || '',
    timestamp: fields[6] || '',
    sendingApplication: fields[2] || '',
    receivingApplication: fields[4] || '',
    framing: boundary.framing,
    length: text.length,
  };
}

function collectBoundaryWarnings(source, messages, sawPrefix, missingFrame) {
  const warnings = [];
  if (/(?:^|[\r\n])(?:FHS|BHS)[^A-Za-z0-9\s]/.test(source)) {
    warnings.push({ code: 'BATCH_HEADERS_PRESENT', summary: 'Batch envelope headers were excluded from message selection.' });
  }
  if (sawPrefix) warnings.push({ code: 'LOG_PREFIX_IGNORED', summary: 'Text before an MSH header was treated as a log prefix.' });
  if (missingFrame) warnings.push({ code: 'MLLP_FRAME_INCOMPLETE', summary: 'An MLLP frame has no closing marker.' });
  if (!messages.length && source.trim()) warnings.push({ code: 'NO_MESSAGES_FOUND', summary: 'No recognizable MSH message boundary was found.' });
  return warnings;
}

export async function catalogHl7(source, {
  onProgress = () => {},
  onMessages = () => {},
  signal,
  chunkSize = 1048576,
} = {}) {
  if (typeof source !== 'string') throw new TypeError('Catalog source must be text');
  throwIfCanceled(signal);
  if (source.length > MAX_FILE_BYTES || byteLength(source) > MAX_FILE_BYTES) {
    const error = new RangeError('The file is larger than 100 MB.');
    error.code = 'FILE_TOO_LARGE';
    throw error;
  }

  const messages = [];
  let pending = null;
  let nextProgress = Math.max(16384, chunkSize);
  let delivered = 0;
  let sawPrefix = false;
  let missingFrame = false;

  async function report(processed) {
    throwIfCanceled(signal);
    const additions = messages.slice(delivered);
    delivered = messages.length;
    if (additions.length) await onMessages(additions);
    onProgress({ processed, total: source.length, messages: messages.length });
    await new Promise((resolve) => setTimeout(resolve, 0));
    throwIfCanceled(signal);
  }

  for (const boundary of scanMessageBoundaries(source)) {
    throwIfCanceled(signal);
    if (pending) {
      const end = pending.frameEnd >= 0 ? pending.frameEnd : boundary.lineStart;
      messages.push(readCatalogMetadata(source, pending, end, messages.length));
    }
    pending = boundary;
    sawPrefix ||= Boolean(boundary.prefix.trim());
    missingFrame ||= boundary.framing === 'MLLP' && boundary.frameEnd < 0;
    while (boundary.start >= nextProgress) {
      await report(nextProgress);
      nextProgress += Math.max(16384, chunkSize);
    }
  }

  if (pending) messages.push(readCatalogMetadata(source, pending, pending.frameEnd >= 0 ? pending.frameEnd : source.length, messages.length));
  while (nextProgress < source.length) {
    await report(nextProgress);
    nextProgress += Math.max(16384, chunkSize);
  }
  await report(source.length);
  return { messages, warnings: collectBoundaryWarnings(source, messages, sawPrefix, missingFrame), bytes: byteLength(source) };
}
