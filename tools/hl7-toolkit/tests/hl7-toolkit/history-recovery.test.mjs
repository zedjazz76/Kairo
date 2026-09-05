import assert from 'node:assert/strict';
import test from 'node:test';
import { appendFileSync, readFileSync, writeFileSync, readdirSync, mkdirSync, symlinkSync, existsSync } from 'node:fs';
import path from 'node:path';
import { startService } from './helpers/service-harness.mjs';
import { createHistoryQueue } from '../../hl7-toolkit/app/scripts/history-queue.mjs';

test('history retry preserves event order and blocks until every failed write is saved', async () => {
  const persisted = []; let diskWritable = false;
  const queue = createHistoryQueue(async (event) => { if (!diskWritable) throw new Error('Disk unavailable'); persisted.push(event.sanitizedText); });
  await assert.rejects(queue.save({ sanitizedText: 'MRN-0001' }));
  await assert.rejects(queue.save({ sanitizedText: 'MRN-0002' }));
  await assert.rejects(queue.ready(), /HISTORY_WRITE_FAILED/);
  assert.equal(queue.failedCount, 2);
  diskWritable = true; await queue.retry(); await queue.ready();
  assert.deepEqual(persisted, ['MRN-0001', 'MRN-0002']); assert.equal(queue.failedCount, 0);
});

test('history recovers a stale manifest and incomplete trailing write without losing complete events', async () => {
  const service = await startService();
  try {
    const event = { schema: 'hl7-toolkit.sanitized-event.v1', type: 'message-save', sanitizedText: 'MRN-0001', policyVersion: 'patient-phi-1.0.0', mode: 'chat-safe', warningCounts: {} };
    await service.request('/api/history/events', { method: 'POST', body: { sessionId: 'crash-test', event } });
    const folder = path.join(service.dataRoot, 'history', 'crash-test');
    const eventsPath = path.join(folder, 'events.jsonl');
    const complete = readFileSync(eventsPath, 'utf8');
    appendFileSync(eventsPath, '{"schema":"hl7-toolkit.sanitized-event.v1"');
    writeFileSync(path.join(folder, 'messages.hl7'), 'stale-cache');
    const result = await service.request('/api/history?sessionId=crash-test');
    assert.equal(result.status, 200); assert.equal(result.data.events.length, 1);
    assert.match(result.data.sanitizedText, /MRN-0001/); assert.doesNotMatch(result.data.sanitizedText, /stale-cache/);
    assert.equal(readFileSync(eventsPath, 'utf8'), complete);
    const next = await service.request('/api/history/events', { method: 'POST', body: { sessionId: 'crash-test', event: { ...event, sanitizedText: 'MRN-0002' } } });
    assert.equal(next.data.eventCount, 2);
    const final = await service.request('/api/history?sessionId=crash-test');
    assert.equal(final.data.events.length, 2);
    assert.equal(readdirSync(folder).some((file) => file.endsWith('.tmp')), false);
  } finally { await service.stop(); }
});

test('history deletion and profile writes cannot follow junctions outside their data folders', async () => {
  const service = await startService();
  try {
    const outside = path.join(service.dataRoot, 'protected-test-target');
    mkdirSync(outside); writeFileSync(path.join(outside, 'keep.txt'), 'KEEP-SYNTHETIC-TARGET');
    mkdirSync(path.join(service.dataRoot, 'history'));
    symlinkSync(outside, path.join(service.dataRoot, 'history', 'linked-session'), 'junction');
    const removed = await service.request('/api/history/session', { method: 'DELETE', body: { sessionIds: ['linked-session'] } });
    assert.equal(removed.status, 400); assert.equal(existsSync(path.join(outside, 'keep.txt')), true);
    mkdirSync(path.join(service.dataRoot, 'history', 'nested-session'));
    symlinkSync(outside, path.join(service.dataRoot, 'history', 'nested-session', 'linked-child'), 'junction');
    const nested = await service.request('/api/history/session', { method: 'DELETE', body: { sessionIds: ['nested-session'] } });
    assert.equal(nested.status, 400); assert.equal(existsSync(path.join(outside, 'keep.txt')), true);
    symlinkSync(outside, path.join(service.dataRoot, 'profiles'), 'junction');
    const profile = { schema: 'hl7-toolkit.endpoint-profile.v1', id: 'test', label: 'Synthetic', environment: 'Test', host: '127.0.0.1', port: 2575, connectTimeoutMs: 1000, responseTimeoutMs: 1000, encoding: 'utf-8', startByte: 11, endBytes: [28, 13], notes: '' };
    const saved = await service.request('/api/profiles/endpoint', { method: 'POST', body: { profile } });
    assert.equal(saved.status, 400); assert.equal(existsSync(path.join(outside, 'test.json')), false);
  } finally { await service.stop(); }
});

test('history readiness waits for writes added while an earlier write is still pending', async () => {
  let releaseFirst; let releaseSecond;
  const queue = createHistoryQueue(async (event) => new Promise((resolve) => { if (event.id === 1) releaseFirst = resolve; else releaseSecond = resolve; }));
  const first = queue.save({ id: 1 });
  let ready = false; const settled = queue.ready().then(() => { ready = true; });
  while (!releaseFirst) await new Promise((resolve) => setTimeout(resolve, 0));
  const second = queue.save({ id: 2 }); releaseFirst(); await first;
  while (!releaseSecond) await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(ready, false); releaseSecond(); await second; await settled; assert.equal(ready, true);
});
