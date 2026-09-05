import assert from 'node:assert/strict';
import test from 'node:test';
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { startService } from './helpers/service-harness.mjs';

test('an idle browser connection cannot indefinitely block the local helper', async () => {
  const service = await startService();
  const address = new URL(service.baseUrl);
  const idle = net.connect(Number(address.port), '127.0.0.1'); idle.on('error', () => {});
  try {
    await new Promise((resolve) => idle.once('connect', resolve));
    const start = performance.now();
    const response = await fetch(service.baseUrl + '/api/session', { headers: { 'X-HL7-Token': service.token }, signal: AbortSignal.timeout(4500) });
    assert.equal(response.status, 200); assert.ok(performance.now() - start < 4000);
  } finally { idle.destroy(); await service.stop(); }
});

test('cross-origin requests are rejected even with a valid session token', async () => {
  const service = await startService();
  try {
    const bad = await service.request('/api/session', { headers: { Origin: 'https://example.invalid' } });
    assert.equal(bad.status, 403);
    assert.equal((await service.request('/api/session', { headers: { Origin: service.baseUrl } })).status, 200);
  } finally { await service.stop(); }
});

test('static image responses preserve their original bytes and content type', async () => {
  const service = await startService();
  try {
    const response = await fetch(service.baseUrl + '/assets/kairo-guardian.png', {
      signal: AbortSignal.timeout(10000),
    });
    const received = Buffer.from(await response.arrayBuffer());
    const expected = readFileSync('hl7-toolkit/app/assets/kairo-guardian.png');

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.deepEqual(received, expected);
  } finally { await service.stop(); }
});
