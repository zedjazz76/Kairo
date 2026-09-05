export function createWorkerRequests(postMessage) {
  const pending = new Map();
  let failed = false;
  return {
    get failed() { return failed; },
    call(type, text, mode = 'chat-safe') {
      if (failed) return Promise.reject(new Error('SANITIZER_WORKER_STOPPED'));
      const id = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        try { postMessage({ type, id, text, mode }); }
        catch { pending.delete(id); reject(new Error('SANITIZER_WORKER_STOPPED')); }
      });
    },
    filter(messages, filter, onProgress = () => {}) {
      if (failed) return Promise.reject(new Error('SANITIZER_WORKER_STOPPED'));
      const id = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, onProgress, kind: 'filter' });
        try { postMessage({ type: 'filter', id, messages, filter }); }
        catch { pending.delete(id); reject(new Error('SANITIZER_WORKER_STOPPED')); }
      });
    },
    handle(data) {
      const operation = pending.get(data.id);
      if (!operation) return false;
      if (data.type === 'filter-progress') {
        operation.onProgress(data);
        return true;
      }
      pending.delete(data.id);
      if (data.type === 'error' || data.type === 'filter-error' || data.type === 'filter-canceled') operation.reject(new DOMException(data.summary || 'Worker request failed', data.type === 'filter-canceled' ? 'AbortError' : 'Error'));
      else if (data.type === 'filter-complete') operation.resolve({ ids: data.ids, matched: data.matched, total: data.total });
      else operation.resolve(data.result);
      return true;
    },
    fail() {
      failed = true;
      for (const operation of pending.values()) operation.reject(new Error('SANITIZER_WORKER_STOPPED'));
      pending.clear();
    },
  };
}
