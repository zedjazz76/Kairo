import assert from 'node:assert/strict';
import test from 'node:test';

import { createWorkerRequests } from '../../hl7-toolkit/app/scripts/worker-requests.mjs';
import { processFilter } from '../../hl7-toolkit/app/workers/intake-worker.mjs';

const message = (id, value) => ({
  id, family: 'ORU', text: 'MSH|^~\\&|LAB|A|EHR|B|202609051100||ORU^R01|' + id + '|P|2.5.1\rOBX|1|TX|NOTE||' + value,
});
const filter = { conditions: [{ id: 'a', target: 'path', field: 'OBX-5', operator: 'contains', value: 'critical' }] };

test('deep filtering reports safe progress and matching IDs', async () => {
  const events = [];
  await processFilter({ id: 'f1', messages: [message('one', 'routine'), message('two', 'critical result')], filter }, {
    emit: (event) => events.push(event),
  });
  assert.ok(events.some(({ type }) => type === 'filter-progress'));
  assert.deepEqual(events.at(-1).ids, ['two']);
  assert.equal(events.at(-1).type, 'filter-complete');
  assert.equal(JSON.stringify(events).includes('critical result'), false);
});

test('deep filtering honors cancellation', async () => {
  const controller = new AbortController();
  await assert.rejects(processFilter({ id: 'f1', messages: Array.from({ length: 500 }, (_, index) => message(String(index), 'routine')), filter }, {
    signal: controller.signal,
    emit: (event) => { if (event.type === 'filter-progress') controller.abort(); },
  }), { name: 'AbortError' });
});

test('worker request helper keeps progress pending and resolves completion', async () => {
  const sent = [];
  const progress = [];
  const requests = createWorkerRequests((payload) => sent.push(payload));
  const promise = requests.filter([message('one', 'routine')], filter, (event) => progress.push(event));
  const id = sent[0].id;
  assert.equal(requests.handle({ type: 'filter-progress', id, processed: 1, total: 1, matched: 0 }), true);
  assert.equal(requests.handle({ type: 'filter-complete', id, ids: [], matched: 0, total: 1 }), true);
  assert.deepEqual(await promise, { ids: [], matched: 0, total: 1 });
  assert.equal(progress.length, 1);
});
