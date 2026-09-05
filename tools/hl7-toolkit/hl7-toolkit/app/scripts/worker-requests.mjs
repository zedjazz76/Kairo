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
    handle(data) {
      const operation = pending.get(data.id);
      if (!operation) return false;
      pending.delete(data.id);
      if (data.type === 'error') operation.reject(new Error(data.code)); else operation.resolve(data.result);
      return true;
    },
    fail() {
      failed = true;
      for (const operation of pending.values()) operation.reject(new Error('SANITIZER_WORKER_STOPPED'));
      pending.clear();
    },
  };
}
