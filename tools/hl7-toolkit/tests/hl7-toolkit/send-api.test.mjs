import assert from 'node:assert/strict';
import test from 'node:test';
import net from 'node:net';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { startService } from './helpers/service-harness.mjs';

test('protected API manages profiles and sends only an explicitly reviewed single request once', async () => {
  const service = await startService();
  let frames = 0;
  const server = net.createServer((socket) => {
    socket.on('error', () => {}); let content = Buffer.alloc(0);
    socket.on('data', (chunk) => { content = Buffer.concat([content, chunk]); if (content.includes(Buffer.from([28, 13]))) { frames += 1; socket.end(Buffer.from('\x0bMSH|^~\\&|TEST|TEST|TOOL|TEST|202609031200||ACK|ACK1|P|2.5.1\rMSA|AA|RAW-CONTROL-123\r\x1c\r')); } });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const profile = { schema: 'hl7-toolkit.endpoint-profile.v1', id: 'synthetic', label: 'Synthetic API test', environment: 'Production', host: '127.0.0.1', port: server.address().port, connectTimeoutMs: 1000, responseTimeoutMs: 1000, encoding: 'utf-8', startByte: 11, endBytes: [28, 13], notes: '' };
    assert.equal((await service.request('/api/profiles/endpoint', { method: 'POST', body: { profile } })).status, 200);
    assert.equal((await service.request('/api/profiles/endpoint')).data.profiles.length, 1);
    const message = 'MSH|^~\\&|TOOL|TEST|TEST|TEST|202609031200||ORM^O01|RAW-CONTROL-123|P|2.5.1\rPID|1||RAW-PATIENT-456\r';
    const payload = { profile, message, messageHash: createHash('sha256').update(message).digest('hex'), requestId: randomUUID(), contentMode: 'original', reviewed: true, productionConfirmed: true };
    const send = (body, headers) => service.request('/api/mllp/send-one', { method: 'POST', body, headers });
    assert.equal((await send(payload, { 'X-HL7-Token': '' })).status, 403);
    assert.equal((await send({ ...payload, reviewed: false })).status, 400);
    assert.equal((await send({ ...payload, productionConfirmed: false })).status, 400);
    assert.equal((await send({ ...payload, messageHash: '0'.repeat(64) })).status, 400);
    assert.equal((await send({ ...payload, message: [message] })).status, 400);
    assert.equal(frames, 0);
    const result = await send(payload);
    assert.equal(result.status, 200); assert.equal(result.data.status, 'response');
    assert.equal((await send(payload)).status, 400); assert.equal(frames, 1);
    const disk = readdirSync(service.dataRoot, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => readFileSync(path.join(entry.parentPath, entry.name), 'utf8')).join('\n');
    assert.doesNotMatch(disk + service.diagnostics(), /RAW-PATIENT-456|RAW-CONTROL-123/);
    assert.equal((await service.request('/api/profiles/endpoint', { method: 'DELETE', body: { id: '../outside' } })).status, 400);
    assert.equal((await service.request('/api/profiles/endpoint', { method: 'DELETE', body: { id: 'synthetic' } })).data.deleted, true);
  } finally { await new Promise((resolve) => server.close(resolve)); await service.stop(); }
});
