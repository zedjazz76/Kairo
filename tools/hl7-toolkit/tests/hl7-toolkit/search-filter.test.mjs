import assert from 'node:assert/strict';
import test from 'node:test';

import { filterMessages, isDeepFilter, validateFilter } from '../../hl7-toolkit/app/scripts/search-filter.mjs';

const messages = [
  { id: 'one', family: 'ADT', type: 'ADT^A01', controlId: 'CTRL-1', version: '2.5.1', timestamp: '202609051000', sendingApplication: 'REG', receivingApplication: 'EHR', framing: 'unframed', length: 90, text: 'MSH|^~\\&|REG|A|EHR|B|202609051000||ADT^A01|CTRL-1|P|2.5.1\rPID|1||MRN-A~MRN-B||ALPHA^PATIENT' },
  { id: 'two', family: 'ORU', type: 'ORU^R01', controlId: 'CTRL-2', version: '2.5.1', timestamp: '202609051100', sendingApplication: 'LAB', receivingApplication: 'EHR', framing: 'MLLP', length: 140, text: 'MSH|^~\\&|LAB|A|EHR|B|202609051100||ORU^R01|CTRL-2|P|2.5.1\rPID|1||MRN-C||BETA^PATIENT\rOBX|1|TX|NOTE||Critical result' },
];

test('combines metadata and path conditions without mutating messages', async () => {
  const original = structuredClone(messages);
  const result = await filterMessages(messages, { conditions: [
    { id: 'a', target: 'metadata', field: 'family', operator: 'equals', value: 'oru' },
    { id: 'b', target: 'path', field: 'OBX-5', operator: 'contains', value: 'critical' },
  ] });
  assert.deepEqual(result, { ids: ['two'], matched: 1, total: 2 });
  assert.deepEqual(messages, original);
});

test('supports metadata presence, text, regex, and numeric operators', async () => {
  const cases = [
    [{ field: 'controlId', operator: 'exists', value: '' }, ['one', 'two']],
    [{ field: 'type', operator: 'contains', value: 'a01' }, ['one']],
    [{ field: 'sendingApplication', operator: 'regex', value: '^L.B$' }, ['two']],
    [{ field: 'length', operator: 'greater-than', value: '100' }, ['two']],
    [{ field: 'length', operator: 'less-than', value: '100' }, ['one']],
  ];
  for (const [condition, ids] of cases) {
    const result = await filterMessages(messages, { conditions: [{ id: 'a', target: 'metadata', ...condition }] });
    assert.deepEqual(result.ids, ids);
  }
});

test('matches any repetition unless a repetition is explicit', async () => {
  const any = await filterMessages(messages, { conditions: [
    { id: 'a', target: 'path', field: 'PID-3.1', operator: 'equals', value: 'MRN-B' },
  ] });
  const explicit = await filterMessages(messages, { conditions: [
    { id: 'a', target: 'path', field: 'PID-3[1].1', operator: 'equals', value: 'MRN-B' },
  ] });
  assert.deepEqual(any.ids, ['one']);
  assert.deepEqual(explicit.ids, []);
});

test('distinguishes missing fields from present empty fields', async () => {
  const empty = await filterMessages(messages, { conditions: [
    { id: 'a', target: 'path', field: 'PID-4', operator: 'empty', value: '' },
  ] });
  const missing = await filterMessages(messages, { conditions: [
    { id: 'a', target: 'path', field: 'OBR-1', operator: 'missing', value: '' },
  ] });
  assert.deepEqual(empty.ids, ['one', 'two']);
  assert.deepEqual(missing.ids, ['one', 'two']);
});

test('validates paths and regex without exposing the supplied value', () => {
  assert.throws(() => validateFilter({ conditions: [{ id: 'a', target: 'path', field: 'BAD', operator: 'equals', value: 'secret' }] }), (error) => error.code === 'FILTER_PATH_INVALID' && !error.message.includes('secret'));
  assert.throws(() => validateFilter({ conditions: [{ id: 'a', target: 'path', field: 'OBX-5', operator: 'regex', value: '(secret' }] }), (error) => error.code === 'FILTER_REGEX_INVALID' && !error.message.includes('secret'));
});

test('identifies deep filters and honors cancellation with safe progress', async () => {
  const filter = validateFilter({ conditions: [{ id: 'a', target: 'path', field: 'PID-3', operator: 'exists', value: '' }] });
  assert.equal(isDeepFilter(filter), true);
  const controller = new AbortController();
  const progress = [];
  await assert.rejects(filterMessages(messages.concat(messages), filter, {
    chunkSize: 1,
    signal: controller.signal,
    onProgress: (event) => { progress.push(event); controller.abort(); },
  }), { name: 'AbortError' });
  assert.deepEqual(Object.keys(progress[0]).sort(), ['matched', 'processed', 'total']);
});
