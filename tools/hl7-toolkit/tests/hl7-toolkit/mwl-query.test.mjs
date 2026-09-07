import assert from 'node:assert/strict';
import test from 'node:test';
import { startService } from './helpers/service-harness.mjs';
import { startMwlPeer } from './helpers/mwl-peer.mjs';

const valid = { schema: 'kairo.mwl-query.v1', host: '127.0.0.1', port: 104, callingAe: 'KAIRO', calledAe: 'MWL', timeoutMs: 300, criteria: { scheduledDate: '20260906' } };

const syntheticItem = () => ({
  patientName: 'SYNTHETIC^PATIENT',
  patientId: 'SYNTHETIC-ID',
  accessionNumber: 'SYNTHETIC-ACCESSION',
  requestedProcedureId: 'SYNTHETIC-PROCEDURE',
  requestedProcedureDescription: 'Synthetic requested procedure',
  scheduledProcedureStep: {
    scheduledStationAe: 'SYNTHETIC_AE',
    scheduledDate: '20260906',
    scheduledTime: '120000',
    modality: 'OT',
    scheduledLocation: 'SYNTHETIC ROOM'
  }
});

async function queryScenarioDetails(scenario) {
  const peer = await startMwlPeer(scenario);
  const service = await startService();
  try {
    const response = await service.request('/api/dicom/mwl/find', {
      method: 'POST',
      body: { ...valid, port: peer.port, timeoutMs: 500 }
    });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return { result: response.data, peer };
  } finally {
    await service.stop();
    await peer.close();
  }
}

async function queryScenario(scenario) {
  return (await queryScenarioDetails(scenario)).result;
}

const matchesThenSuccess = count => ({ responses: [
  ...Array.from({ length: count }, () => ({ status: 0xff00, item: syntheticItem() })),
  { status: 0x0000 }
] });

const pendingMatches = count => Array.from({ length: count }, () => ({ status: 0xff00, item: syntheticItem() }));

const matchesUntilCancel = (count, options = {}) => ({ responses: pendingMatches(count), ...options });

test('protected MWL route rejects unauthorized, wrong method and unconstrained input', async () => {
  const service = await startService();
  try {
    assert.equal((await service.request('/api/dicom/mwl/find', { method: 'POST', body: valid, headers: { 'X-HL7-Token': 'wrong' } })).status, 403);
    assert.equal((await service.request('/api/dicom/mwl/find', { method: 'GET' })).status, 400);
    assert.equal((await service.request('/api/dicom/mwl/find', { method: 'POST', body: { ...valid, criteria: {} } })).status, 400);
    assert.equal((await service.request('/api/dicom/mwl/find', { method: 'POST', body: { ...valid, callingAe: 'BAD\\AE' } })).status, 400);
  } finally { await service.stop(); }
});

test('valid MWL request reaches only the isolated runtime boundary', async () => {
  const service = await startService({ launcher: 'tests/hl7-toolkit/helpers/diagnostics-policy-block.ps1' });
  try {
    const response = await service.request('/api/dicom/mwl/find', { method: 'POST', body: valid });
    assert.equal(response.status, 503);
    assert.equal(response.data.error, 'MWL_RUNTIME_UNAVAILABLE');
  } finally { await service.stop(); }
});

test('terminal 0000 with no pending response is successful zero matches', async () => {
  const result = await queryScenario({ responses: [{ status: 0x0000 }] });
  assert.equal(result.classification, 'SUCCESS_ZERO_MATCHES');
  assert.equal(result.cfind.dicomStatus, '0x0000');
  assert.equal(result.matches.retained, 0);
});

test('one pending identifier followed by 0000 is a successful match', async () => {
  const result = await queryScenario({ responses: [{ status: 0xff00, item: syntheticItem() }, { status: 0x0000 }] });
  assert.equal(result.classification, 'SUCCESS_MATCHES');
  assert.equal(result.items.length, 1);
});

test('C-FIND failure preserves DNS TCP and association success', async () => {
  const result = await queryScenario({ responses: [{ status: 0xa900 }] });
  assert.equal(result.tcp.code, 'TCP_CONNECTED');
  assert.equal(result.association.code, 'ASSOCIATION_ACCEPTED');
  assert.equal(result.cfind.code, 'C_FIND_IDENTIFIER_REJECTED');
  assert.equal(result.matches.code, 'NOT_RUN');
});

for (const scenario of [
  { name: 'absent character set uses the DICOM default repertoire', specificCharacterSet: undefined, textEncoding: 'ascii', description: 'Synthetic ASCII procedure' },
  { name: 'ISO_IR 6 decodes strict ASCII', specificCharacterSet: 'ISO_IR 6', textEncoding: 'ascii', description: 'Explicit ASCII procedure' },
  { name: 'ISO_IR 100 decodes ISO-8859-1', specificCharacterSet: 'ISO_IR 100', textEncoding: 'latin1', description: 'Procédure synthétique' },
  { name: 'ISO_IR 192 decodes strict UTF-8', specificCharacterSet: 'ISO_IR 192', textEncoding: 'utf8', description: '検査手順' }
]) {
  test(scenario.name, async () => {
    const item = { ...syntheticItem(), specificCharacterSet: scenario.specificCharacterSet, textEncoding: scenario.textEncoding, requestedProcedureDescription: scenario.description };
    const result = await queryScenario({ responses: [{ status: 0xff00, item }, { status: 0x0000 }] });
    assert.equal(result.items[0].requestedProcedureDescription, scenario.description);
  });
}

test('unsupported character set keeps query success and withholds text bytes', async () => {
  const item = { ...syntheticItem(), specificCharacterSet: 'ISO_IR 999', requestedProcedureDescription: 'UNDECODED-PATIENT-CANARY' };
  const result = await queryScenario({ responses: [{ status: 0xff00, item }, { status: 0x0000 }] });
  assert.match(result.classification, /^SUCCESS_/);
  assert.equal(result.items[0].patientName, 'CHARACTER_SET_NOT_SUPPORTED');
  assert.match(result.warnings[0].code, /CHARACTER_SET_NOT_SUPPORTED/);
  assert.doesNotMatch(JSON.stringify(result), /UNDECODED-PATIENT-CANARY|�/);
});

test('nested Scheduled Procedure Step values are projected from the sequence item', async () => {
  const result = await queryScenario({ responses: [{ status: 0xff00, item: syntheticItem() }, { status: 0x0000 }] });
  assert.deepEqual(result.items[0].scheduledProcedureStep, {
    scheduledStationAe: 'SYNTHETIC_AE',
    scheduledDate: '20260906',
    scheduledTime: '120000',
    modality: 'OT',
    scheduledLocation: 'SYNTHETIC ROOM'
  });
});

test('99 matches complete normally', async () => {
  const result = await queryScenario(matchesThenSuccess(99));
  assert.equal(result.items.length, 99);
  assert.equal(result.classification, 'SUCCESS_MATCHES');
  assert.equal(result.matches.truncated, false);
});

test('match 100 triggers correlated C-CANCEL and truncation', async () => {
  const { result, peer } = await queryScenarioDetails(matchesUntilCancel(101, { cancelResponseStatus: 0xfe00 }));
  assert.equal(result.items.length, 100);
  assert.equal(result.classification, 'SUCCESS_TRUNCATED');
  assert.equal(result.matches.truncated, true);
  assert.equal(result.cancellation.code, 'CANCEL_CONFIRMED');
  assert.equal(peer.requests.cancel.messageIdBeingRespondedTo, peer.requests.find.messageId);
});

test('exactly 100 matches triggers the fixed cap and preserves all retained results', async () => {
  const result = await queryScenario(matchesUntilCancel(100, { cancelResponseStatus: 0xfe00 }));
  assert.equal(result.items.length, 100);
  assert.equal(result.matches.retained, 100);
  assert.equal(result.matches.truncated, true);
  assert.equal(result.classification, 'SUCCESS_TRUNCATED');
  assert.equal(result.cancellation.code, 'CANCEL_CONFIRMED');
  assert.equal(result.cfind.dicomStatus, '0xFE00');
});

test('final-response/cancel race preserves the cap and actual final status', async () => {
  const result = await queryScenario({ responses: [...pendingMatches(100), { status: 0x0000 }] });
  assert.equal(result.items.length, 100);
  assert.equal(result.classification, 'SUCCESS_TRUNCATED');
  assert.equal(result.cancellation.code, 'FINAL_RESPONSE_RACED_CANCEL');
  assert.equal(result.cfind.dicomStatus, '0x0000');
});

test('C-CANCEL timeout preserves 100 retained results', async () => {
  const result = await queryScenario(matchesUntilCancel(100));
  assert.equal(result.items.length, 100);
  assert.equal(result.matches.retained, 100);
  assert.equal(result.classification, 'SUCCESS_TRUNCATED');
  assert.equal(result.cancellation.code, 'CANCEL_TIMEOUT');
});

test('C-CANCEL send failure preserves 100 retained results', async () => {
  const result = await queryScenario(matchesUntilCancel(100, { resetBeforeCancel: true }));
  assert.equal(result.items.length, 100);
  assert.equal(result.matches.retained, 100);
  assert.equal(result.classification, 'SUCCESS_TRUNCATED');
  assert.equal(result.cancellation.code, 'CANCEL_SEND_FAILED');
});

test('association close after C-CANCEL preserves 100 retained results', async () => {
  const result = await queryScenario(matchesUntilCancel(100, { closeAfterCancel: true }));
  assert.equal(result.items.length, 100);
  assert.equal(result.matches.retained, 100);
  assert.equal(result.classification, 'SUCCESS_TRUNCATED');
  assert.equal(result.cancellation.code, 'ASSOCIATION_CLOSED_AFTER_CANCEL');
});
