const CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
const MAX_FAILURES = 10;

export function normalizeFailureCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (CODE.test(code)) return code;
  return 'OPERATOR_FAILURE';
}

export function createFailureMuseum({ limit = MAX_FAILURES } = {}) {
  const items = [];
  return {
    record(code, source = 'session') {
      items.unshift({
        code: normalizeFailureCode(code),
        source: String(source || 'session').slice(0, 32),
        at: Date.now(),
      });
      if (items.length > limit) items.length = limit;
      return this.list();
    },
    list() {
      return items.map((item) => ({ ...item }));
    },
    clear() {
      items.length = 0;
    },
  };
}

export async function sanitizeClipboardText(text, sanitizer, mode = 'chat-safe') {
  if (typeof text !== 'string' || !text.trim()) throw new Error('CLIPBOARD_EMPTY');
  if (!sanitizer || typeof sanitizer.sanitize !== 'function') throw new Error('SANITIZER_REQUIRED');
  const result = sanitizer.sanitize(text, mode);
  if (!result || typeof result.text !== 'string') throw new Error('SANITIZE_FAILED');
  return result;
}

export async function runClipboardSanitize({
  readText,
  writeText,
  sanitizer,
  mode = 'chat-safe',
  museum,
} = {}) {
  if (typeof readText !== 'function' || typeof writeText !== 'function') throw new Error('CLIPBOARD_API_REQUIRED');
  try {
    const source = await readText();
    const result = await sanitizeClipboardText(source, sanitizer, mode);
    await writeText(result.text);
    return {
      copiedCharacters: result.text.length,
      replacementCount: result.replacements?.length || 0,
      warningCount: result.warnings?.length || 0,
      policyVersion: result.policyVersion,
    };
  } catch (error) {
    museum?.record(error?.message || 'CLIPBOARD_SANITIZE_FAILED', 'clipboard');
    throw error;
  }
}
