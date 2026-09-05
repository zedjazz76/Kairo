import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkerRequests } from '../../hl7-toolkit/app/scripts/worker-requests.mjs';

test('worker failure rejects pending and future sanitization instead of hanging protected actions', async () => {
  const sent = [];
  const requests = createWorkerRequests((message) => sent.push(message));
  const first = requests.call('sanitize', 'synthetic input');
  const rejection = assert.rejects(first, /SANITIZER_WORKER_STOPPED/);
  requests.fail(); await rejection;
  await assert.rejects(requests.call('scan', 'synthetic input'), /SANITIZER_WORKER_STOPPED/);
  assert.equal(sent.length, 1); assert.equal(requests.failed, true);
});

test('worker replies resolve only their matching request and return unrelated events to the workbench', async () => {
  const sent = [];
  const requests = createWorkerRequests((message) => sent.push(message));
  const first = requests.call('sanitize', 'one'); const second = requests.call('scan', 'two');
  assert.equal(requests.handle({ id: 'unrelated', type: 'messages' }), false);
  requests.handle({ id: sent[1].id, type: 'scan-result', result: [] });
  requests.handle({ id: sent[0].id, type: 'sanitize-result', result: { text: 'NAME-0001' } });
  assert.deepEqual(await second, []); assert.equal((await first).text, 'NAME-0001');
});
