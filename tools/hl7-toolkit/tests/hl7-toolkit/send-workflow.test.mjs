import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createSingleSender } from '../../hl7-toolkit/app/scripts/send-workflow.mjs';
import { createSanitizerSession } from '../../hl7-toolkit/app/scripts/sanitizer.mjs';

const rules = JSON.parse(readFileSync('hl7-toolkit/app/definitions/phi-rules.v1.json', 'utf8'));
const text = 'MSH|^~\\&|TOOL|TEST|STUB|TEST|202609031200||ORM^O01|RAW-CONTROL-7722|P|2.5.1\rPID|1||RAW-PATIENT-8822||CANARYNAME^EXAMPLE\r';
const profile = { schema: 'hl7-toolkit.endpoint-profile.v1', id: 'test', label: 'Test only', environment: 'Test', host: '127.0.0.1', port: 2575, connectTimeoutMs: 1000, responseTimeoutMs: 1000, encoding: 'utf-8', startByte: 11, endBytes: [28, 13], notes: '' };
function setup(overrides = {}) {
  const state = { text, messageId: 'one', profile: { ...profile }, mode: 'original', dirty: false, findings: [] };
  const events = []; const requests = []; const confirmations = [];
  const sanitizer = createSanitizerSession(rules);
  const sender = createSingleSender({
    getSnapshot: () => structuredClone(state), historyReady: async () => {},
    sanitize: async (value, mode) => sanitizer.sanitize(value, mode),
    saveEvent: async (event) => { events.push(event); },
    send: async (request) => { requests.push(request); return { status: 'response', bytesSent: 100, latencyMs: 10, response: 'MSH|^~\\&|STUB|TEST|TOOL|TEST|202609031200||ACK|ACK1|P|2.5.1\rMSA|AA|RAW-CONTROL-7722\r', deliveryUncertain: false }; },
    confirm: async (review) => { confirmations.push(review); return { confirmed: true, acknowledgedIds: review.requiredIds || [] }; },
    ...overrides,
  });
  return { sender, state, events, requests, confirmations };
}
test('one send records only sanitized request and response, after explicit review', async () => {
  const { sender, events, requests, confirmations } = setup();
  const result = await sender.run();
  assert.equal(requests.length, 1); assert.equal(confirmations.length, 1);
  assert.equal(requests[0].message, text); assert.equal(requests[0].reviewed, true);
  assert.equal(result.ack.accepted, true); assert.equal(result.historySaved, true);
  assert.deepEqual(events.map((event) => event.outcome), ['authorized', 'response']);
  assert.doesNotMatch(JSON.stringify(events), /RAW-CONTROL-7722|RAW-PATIENT-8822|CANARYNAME/);
});
test('dirty edits, missing acknowledgements, and failed history prevent transmission', async () => {
  const dirty = setup(); dirty.state.dirty = true;
  await assert.rejects(dirty.sender.run(), /APPLY_EDITS_FIRST/); assert.equal(dirty.requests.length, 0);
  const warnings = setup({ confirm: async () => ({ confirmed: true, acknowledgedIds: [] }) });
  warnings.state.text = text.replace('202609031200', 'BADDATE');
  await assert.rejects(warnings.sender.run(), /REVIEW_WARNINGS_REQUIRED/); assert.equal(warnings.requests.length, 0);
  const history = setup({ saveEvent: async () => { throw new Error('HISTORY_WRITE_FAILED'); } });
  await assert.rejects(history.sender.run(), /HISTORY_WRITE_FAILED/); assert.equal(history.requests.length, 0);
});
test('Production original requires a second explicit confirmation and cancellation sends nothing', async () => {
  const task = setup(); task.state.profile.environment = 'Production';
  await task.sender.run(); assert.equal(task.confirmations.length, 2); assert.equal(task.requests[0].productionConfirmed, true);
  const canceled = setup({ confirm: async () => ({ confirmed: false }) });
  const result = await canceled.sender.run(); assert.equal(result.status, 'canceled'); assert.equal(canceled.requests.length, 0);
});
test('changed message or destination after review invalidates the send', async () => {
  let task;
  task = setup({ confirm: async () => { task.state.profile.port = 9999; return { confirmed: true, acknowledgedIds: [] }; } });
  await assert.rejects(task.sender.run(), /SEND_REVIEW_EXPIRED/); assert.equal(task.requests.length, 0);
});
test('double-click is blocked and lost response never retries', async () => {
  let release; let calls = 0;
  const task = setup({ send: async () => { calls += 1; await new Promise((resolve) => { release = resolve; }); throw new Error('connection lost'); } });
  const first = task.sender.run();
  await assert.rejects(task.sender.run(), /SEND_ALREADY_RUNNING/);
  while (!release) await new Promise((resolve) => setTimeout(resolve, 1));
  release(); const result = await first;
  assert.equal(calls, 1); assert.equal(result.status, 'unknown-delivery'); assert.equal(result.deliveryUncertain, true);
});
test('failure to save a received result preserves the result and does not resend', async () => {
  let count = 0;
  const task = setup({ saveEvent: async () => { if (++count > 1) throw new Error('disk full'); } });
  const result = await task.sender.run();
  assert.equal(result.ack.accepted, true); assert.equal(result.historySaved, false); assert.equal(task.requests.length, 1);
});

test('a known pre-transmission helper rejection is distinguished from lost delivery', async () => {
  const task = setup({ send: async () => { throw Object.assign(new Error('SEND_ENCODING_UNSUPPORTED_CHARACTER'), { httpStatus: 400 }); } });
  const result = await task.sender.run();
  assert.equal(result.status, 'send-failed'); assert.equal(result.deliveryUncertain, false); assert.equal(result.writeAttempted, false);
  assert.equal(result.errorCode, 'SEND_ENCODING_UNSUPPORTED_CHARACTER');
});
