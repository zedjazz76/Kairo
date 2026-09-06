import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { mountDiagnostics } from '../../hl7-toolkit/app/scripts/diagnostics-ui.mjs';

test('diagnostics require a click, send one explicit endpoint and render layer evidence safely', async () => {
  const html = await readFile(new URL('../../hl7-toolkit/app/index.html', import.meta.url), 'utf8');
  assert.match(html, /data-nav="diagnostics"/);
  const nodes = new Map();
  const root = { querySelector(selector) {
    assert.ok(html.includes(`id="${selector.slice(1)}"`), selector);
    if (!nodes.has(selector)) nodes.set(selector, { value: '', textContent: '', listeners: {}, reportValidity: () => true, addEventListener(type, fn) { this.listeners[type] = fn; } });
    return nodes.get(selector);
  } };
  const requests = []; let finish;
  const api = { request(path, request) { requests.push({ path, ...request }); return new Promise(resolve => { finish = resolve; }); } };
  mountDiagnostics(root, api);
  assert.equal(requests.length, 0);
  for (const [id, value] of Object.entries({ host: '127.0.0.1', port: '104', timeout: '3000', calling: 'KAIRO', called: 'TEST_SCP' })) root.querySelector('#diagnostic-' + id).value = value;
  const pending = root.querySelector('#diagnostic-echo').listeners.click();
  await root.querySelector('#diagnostic-tcp').listeners.click();
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0], { path: '/api/diagnostics/run', method: 'POST', body: { mode: 'dicom', host: '127.0.0.1', port: 104, timeoutMs: 3000, callingAe: 'KAIRO', calledAe: 'TEST_SCP' } });
  assert.equal(root.querySelector('#diagnostic-echo').disabled, true);
  finish({ classification: 'ASSOCIATION_REJECTED', timestamp: '2026-09-05T12:00:00Z', resolvedAddress: '127.0.0.1', host: '<untrusted>', port: 104, elapsedMs: 10,
    dns: { code: 'NOT_REQUIRED', state: 'SUCCESS', elapsedMs: 0, detail: 'IP literal' }, tcp: { code: 'TCP_CONNECTED', state: 'SUCCESS', elapsedMs: 1, detail: 'Connection only' },
    association: { code: 'ASSOCIATION_REJECTED', state: 'REJECTED', elapsedMs: 9, detail: 'Called AE title not recognized.' }, echo: { code: 'NOT_RUN', state: 'NOT_RUN', elapsedMs: 0, detail: 'Not attempted.' }, release: 'NOT_RUN' });
  await pending;
  assert.match(root.querySelector('#diagnostic-result').textContent, /ASSOCIATION_REJECTED/);
  assert.match(root.querySelector('#diagnostic-layer-tcp').textContent, /TCP_CONNECTED/);
  assert.match(root.querySelector('#diagnostic-layer-association').textContent, /Called AE/);
  assert.match(root.querySelector('#diagnostic-layer-echo').textContent, /NOT_RUN/);
  assert.equal(root.querySelector('#diagnostic-echo').disabled, false);
  assert.equal(root.querySelector('#diagnostic-result').innerHTML, undefined);
});

test('helper failure clears stale evidence and permits an explicit retry', async () => {
  const nodes = new Map();
  const root = { querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, { value: '1', listeners: {}, reportValidity: () => true, addEventListener(type, fn) { this.listeners[type] = fn; } }); return nodes.get(selector); } };
  mountDiagnostics(root, { request: async () => { throw new Error('PRIVATE-RAW-ERROR'); } });
  await root.querySelector('#diagnostic-tcp').listeners.click();
  assert.ok(!root.querySelector('#diagnostic-result').textContent.includes('PRIVATE'));
  assert.match(root.querySelector('#diagnostic-result').textContent, /failed/i);
  assert.equal(root.querySelector('#diagnostic-layer-echo').textContent, 'C-ECHO: NOT_RUN');
  assert.equal(root.querySelector('#diagnostic-tcp').disabled, false);
  mountDiagnostics(root, { request: async () => { throw new Error('DIAGNOSTIC_RUNTIME_UNAVAILABLE'); } });
  await root.querySelector('#diagnostic-tcp').listeners.click();
  assert.match(root.querySelector('#diagnostic-result').textContent, /runtime policy/);
  assert.match(root.querySelector('#diagnostic-result').textContent, /Existing tools remain available/);
});

test('HTTP TLS UI requires a click and renders layer, certificate and redirect evidence', async () => {
  const html = await readFile(new URL('../../hl7-toolkit/app/index.html', import.meta.url), 'utf8'); const nodes = new Map();
  const root = { querySelector(selector) { assert.ok(html.includes(`id="${selector.slice(1)}"`), selector); if (!nodes.has(selector)) nodes.set(selector, { value: '', textContent: '', listeners: {}, reportValidity: () => true, addEventListener(type, fn) { this.listeners[type] = fn; } }); return nodes.get(selector); } };
  const requests = [];
  mountDiagnostics(root, { request: async (path, request) => { requests.push({ path, ...request }); return { classification: 'HTTP_RESPONSE', host: 'example.test', port: 443, scheme: 'https', timestamp: '2026-09-06T12:00:00Z', resolvedAddress: '192.0.2.10', elapsedMs: 21, httpStatus: 302, redirectLocation: '/ready', tlsVersion: 'Tls12', hostnameValidation: 'VALID', certificateSubject: 'CN=example.test', certificateIssuer: 'CN=Test CA', certificateValidFrom: '2026-01-01T00:00:00Z', certificateValidTo: '2027-01-01T00:00:00Z', certificateDaysUntilExpiration: 117, headers: { location: '/ready' }, dns: { state: 'SUCCESS', code: 'RESOLVED', elapsedMs: 2, detail: 'Resolved' }, tcp: { state: 'SUCCESS', code: 'TCP_CONNECTED', elapsedMs: 3, detail: 'Connected' }, tls: { state: 'SUCCESS', code: 'TLS_CONNECTED', elapsedMs: 8, detail: 'Validated' }, http: { state: 'SUCCESS', code: 'HTTP_RESPONSE', elapsedMs: 8, detail: 'Headers only' } }; } });
  root.querySelector('#diagnostic-http-target').value = 'https://example.test/health'; root.querySelector('#diagnostic-http-timeout').value = '3000';
  await root.querySelector('#diagnostic-http-run').listeners.click();
  assert.deepEqual(requests, [{ path: '/api/diagnostics/run', method: 'POST', body: { mode: 'http', target: 'https://example.test/health', timeoutMs: 3000 } }]);
  assert.match(root.querySelector('#diagnostic-http-summary').textContent, /HTTP_RESPONSE.*302/); assert.match(root.querySelector('#diagnostic-http-layer-tls').textContent, /TLS_CONNECTED/);
  assert.match(root.querySelector('#diagnostic-http-certificate').textContent, /CN=example\.test.*Test CA.*117/); assert.match(root.querySelector('#diagnostic-http-response').textContent, /location: \/ready/);
  assert.match(root.querySelector('#diagnostic-http-tls-evidence').textContent, /TargetHost.*Certificate received/);
});

test('HTTP TLS UI does not report hostname mismatch when no certificate was received', async () => {
  const nodes = new Map(); const root = { querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, { value: '', textContent: '', listeners: {}, reportValidity: () => true, addEventListener(type, fn) { this.listeners[type] = fn; } }); return nodes.get(selector); } };
  mountDiagnostics(root, { request: async () => ({ classification: 'TLS_HANDSHAKE_FAILED', host: 'google.com', port: 443, scheme: 'https', timestamp: '2026-09-06T12:00:00Z', resolvedAddress: '142.250.1.1', elapsedMs: 10, httpStatus: 0, hostnameValidation: 'NOT_AVAILABLE', certificateSubject: '', headers: {}, dns: { state: 'SUCCESS', code: 'RESOLVED', elapsedMs: 1, detail: 'Resolved' }, tcp: { state: 'SUCCESS', code: 'TCP_CONNECTED', elapsedMs: 2, detail: 'Connected' }, tls: { state: 'FAILED', code: 'TLS_HANDSHAKE_FAILED', elapsedMs: 7, detail: 'No certificate' }, http: { state: 'NOT_RUN', code: 'NOT_RUN', elapsedMs: 0, detail: 'Not attempted' } }) });
  root.querySelector('#diagnostic-http-target').value = 'https://google.com'; root.querySelector('#diagnostic-http-timeout').value = '3000'; await root.querySelector('#diagnostic-http-run').listeners.click();
  assert.match(root.querySelector('#diagnostic-http-certificate').textContent, /Hostname valid: NOT_AVAILABLE/); assert.doesNotMatch(root.querySelector('#diagnostic-http-certificate').textContent, /Hostname valid: NO(?:\s|·|$)/);
});
