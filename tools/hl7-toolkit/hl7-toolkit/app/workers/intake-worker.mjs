import { catalogHl7, MAX_FILE_BYTES } from '../scripts/message-catalog.mjs';
import { createSanitizerSession, historySafeText } from '../scripts/sanitizer.mjs';
import { filterMessages } from '../scripts/search-filter.mjs';

export async function processIntake(request, { emit, signal, sanitizer } = {}) {
  if (request.file?.size > MAX_FILE_BYTES) {
    const error = new RangeError('The file is larger than 100 MB.');
    error.code = 'FILE_TOO_LARGE';
    throw error;
  }
  const source = request.file ? await request.file.text() : request.text;
  const result = await catalogHl7(source, {
    signal,
    onMessages: async (messages) => {
      if (sanitizer) {
        let results = []; let readyMessages = [];
        const flush = () => {
          if (!results.length) return;
          emit({ type: 'archive', id: request.id, results });
          emit({ type: 'messages', id: request.id, messages: readyMessages });
          results = []; readyMessages = [];
        };
        for (const message of messages) {
          if (signal?.aborted) throw new DOMException('Intake canceled', 'AbortError');
          const result = sanitizer.sanitize(message.text, 'chat-safe');
          results.push({ messageId: message.id, result, historyText: historySafeText(result) });
          readyMessages.push(message);
          if (results.length >= 64) {
            flush();
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
        flush();
      } else emit({ type: 'messages', id: request.id, messages });
    },
    onProgress: (progress) => emit({ type: 'progress', id: request.id, ...progress }),
  });
  emit({ type: 'complete', id: request.id, count: result.messages.length, warnings: result.warnings, bytes: result.bytes });
  return result;
}

export async function processFilter(request, { emit, signal } = {}) {
  const result = await filterMessages(request.messages, request.filter, {
    signal,
    onProgress: (progress) => emit({ type: 'filter-progress', id: request.id, ...progress }),
  });
  emit({ type: 'filter-complete', id: request.id, ...result });
  return result;
}

if (typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope) {
  let activeController;
  let activeFilterController;
  let sanitizer;
  globalThis.onmessage = async ({ data }) => {
    if (data.type === 'initialize') {
      sanitizer?.destroy();
      sanitizer = createSanitizerSession(data.rules);
      globalThis.postMessage({ type: 'ready', id: data.id });
      return;
    }
    if (data.type === 'sanitize' || data.type === 'scan') {
      try {
        if (!sanitizer) throw new Error('SANITIZER_NOT_READY');
        const result = data.type === 'sanitize' ? sanitizer.sanitize(data.text, data.mode) : sanitizer.scan(data.text, data.mode);
        globalThis.postMessage({ type: data.type + '-result', id: data.id, result });
      } catch {
        globalThis.postMessage({ type: 'error', id: data.id, code: 'SANITIZER_FAILED', summary: 'Sanitization did not complete.' });
      }
      return;
    }
    if (data.type === 'cancel') {
      activeController?.abort();
      activeFilterController?.abort();
      return;
    }
    if (data.type === 'filter') {
      activeFilterController?.abort();
      const controller = new AbortController();
      activeFilterController = controller;
      try {
        await processFilter(data, { emit: (event) => globalThis.postMessage(event), signal: controller.signal });
      } catch (error) {
        globalThis.postMessage({
          type: error.name === 'AbortError' ? 'filter-canceled' : 'filter-error',
          id: data.id,
          code: error.code || 'FILTER_FAILED',
          summary: error.name === 'AbortError' ? 'Filtering canceled.' : 'Filtering did not complete.',
        });
      }
      return;
    }
    if (data.type !== 'catalog') return;
    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;
    try {
      await processIntake(data, { emit: (event) => globalThis.postMessage(event), signal: controller.signal, sanitizer });
    } catch (error) {
      globalThis.postMessage({
        type: error.name === 'AbortError' ? 'canceled' : 'error',
        id: data.id,
        code: error.code || 'INTAKE_FAILED',
        summary: error.code === 'FILE_TOO_LARGE' ? 'The file is larger than 100 MB.' : 'Intake did not complete.',
      });
    }
  };
}
