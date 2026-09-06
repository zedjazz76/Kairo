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
