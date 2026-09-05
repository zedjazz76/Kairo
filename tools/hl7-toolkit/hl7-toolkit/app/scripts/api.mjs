export function createApi({ token, sessionId, baseUrl = globalThis.location?.origin || '' }) {
  const address = new URL(baseUrl);
  if (address.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(address.hostname)) {
    throw new Error('LOOPBACK_REQUIRED');
  }

  async function request(path, { method = 'GET', body, signal } = {}) {
    if (!path.startsWith('/api/')) throw new Error('API_PATH_REQUIRED');
    const response = await fetch(address.origin + path, {
      method,
      headers: { 'X-HL7-Token': token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store', credentials: 'omit', signal,
    });
    let result;
    try { result = await response.json(); }
    catch { throw new Error('HELPER_RESPONSE_INVALID'); }
    if (!response.ok) {
      const code = /^[A-Z][A-Z0-9_]{0,80}$/.test(result.error) ? result.error : 'HELPER_REQUEST_FAILED';
      throw Object.assign(new Error(code), { httpStatus: response.status });
    }
    return result;
  }

  return {
    request,
    sessionId,
    saveSanitizedEvent: (event) => request('/api/history/events', { method: 'POST', body: { sessionId, event } }),
    getHistory: (id) => request('/api/history' + (id ? `?sessionId=${encodeURIComponent(id)}` : '')),
    deleteHistory: (sessionIds) => request('/api/history/session', { method: 'DELETE', body: { sessionIds } }),
  };
}
