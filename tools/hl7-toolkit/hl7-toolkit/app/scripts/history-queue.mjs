export function createHistoryQueue(write, onChange = () => {}) {
  let tail = Promise.resolve();
  let pending = 0;
  const failed = [];
  const changed = () => onChange({ pending, failed: failed.length, healthy: failed.length === 0 });
  return {
    get pendingCount() { return pending; },
    get failedCount() { return failed.length; },
    save(event) {
      pending += 1; changed();
      const operation = tail.catch(() => {}).then(async () => {
        try {
          if (failed.length) throw new Error('HISTORY_WRITE_FAILED');
          return await write(event);
        } catch (error) { failed.push(event); throw error; }
        finally { pending -= 1; changed(); }
      });
      tail = operation;
      return operation;
    },
    retry() {
      const operation = tail.catch(() => {}).then(async () => {
        try { while (failed.length) { await write(failed[0]); failed.shift(); changed(); } }
        finally { changed(); }
      });
      tail = operation;
      return operation;
    },
    async ready() {
      let observed;
      do { observed = tail; await observed.catch(() => {}); } while (observed !== tail);
      if (failed.length) throw new Error('HISTORY_WRITE_FAILED');
    },
  };
}
