import assert from 'node:assert/strict';
import test from 'node:test';
import { startService } from './helpers/service-harness.mjs';
import { startStudyQueryPeer } from './helpers/study-query-peer.mjs';

const valid = { schema: 'kairo.study-query.v1', host: '127.0.0.1', port: 104, callingAe: 'KAIRO', calledAe: 'PACS', timeoutMs: 300, criteria: { accessionNumber: 'SYNTH-ACC' } };
const item = { patientName: 'SYNTHETIC^PATIENT', patientId: 'SYNTH-ID', accessionNumber: 'SYNTH-ACC', studyDate: '20260907', studyTime: '103000', studyDescription: 'Synthetic MR brain', modalitiesInStudy: 'MR', studyInstanceUid: '1.2.840.999.1', numberOfStudyRelatedSeries: '2', numberOfStudyRelatedInstances: '8', referringPhysicianName: 'SYNTHETIC^REFERRER' };

async function queryScenario(scenario, criteria = valid.criteria) {
  const peer = await startStudyQueryPeer(scenario); const service = await startService();
  try {
    const response = await service.request('/api/dicom/studies/find', { method: 'POST', body: { ...valid, port: peer.port, timeoutMs: 500, criteria } });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return { result: response.data, observations: peer.observations };
  } finally { await service.stop(); await peer.close(); }
}

test('Study Query route is protected, POST-only, strict, and rejects unconstrained input locally', async () => {
  const service = await startService({ launcher: 'tests/hl7-toolkit/helpers/diagnostics-policy-block.ps1' });
  try {
    assert.equal((await service.request('/api/dicom/studies/find', { method: 'POST', body: valid, headers: { 'X-HL7-Token': 'wrong' } })).status, 403);
    assert.equal((await service.request('/api/dicom/studies/find', { method: 'GET' })).status, 400);
    for (const body of [
      { ...valid, criteria: {} },
      { ...valid, criteria: { accessionNumber: 'A*' } },
      { ...valid, criteria: { studyInstanceUid: '1.2.BAD' } },
      { ...valid, criteria: { studyDate: '20269999' } },
      { ...valid, extra: true },
      [valid]
    ]) assert.equal((await service.request('/api/dicom/studies/find', { method: 'POST', body })).status, 400);
  } finally { await service.stop(); }
});

test('valid Study Query reaches only its typed runtime boundary', async () => {
  const service = await startService({ launcher: 'tests/hl7-toolkit/helpers/diagnostics-policy-block.ps1' });
  try {
    const response = await service.request('/api/dicom/studies/find', { method: 'POST', body: valid });
    assert.equal(response.status, 503);
    assert.equal(response.data.error, 'STUDY_RUNTIME_UNAVAILABLE');
  } finally { await service.stop(); }
});

test('Study Root query sends STUDY level and returns successful zero matches with actual status', async () => {
  const { result, observations } = await queryScenario({ responses: [{ status: 0x0000 }] });
  assert.equal(observations.sopClassUid, '1.2.840.10008.5.1.4.1.2.2.1');
  assert.equal(observations.queryRetrieveLevel, 'STUDY');
  assert.equal(observations.connections, 1);
  assert.equal(result.classification, 'SUCCESS_ZERO_MATCHES');
  assert.equal(result.cfind.dicomStatus, '0x0000');
  assert.equal(result.matches.retained, 0);
});

test('Study Root query returns one provenance-bearing study match', async () => {
  const { result } = await queryScenario({ responses: [{ status: 0xff00, item }, { status: 0x0000 }] }, { patientId: 'SYNTH-ID', modalitiesInStudy: 'MR' });
  assert.equal(result.classification, 'SUCCESS_MATCHES');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].studyInstanceUid, '1.2.840.999.1');
  assert.ok(result.items[0].tags.some(tag => tag.tag === '0020000D' && tag.value === '1.2.840.999.1'));
});

test('Study Root accepts Explicit VR Little Endian and decodes the same study projection', async () => {
  const { result, observations } = await queryScenario({ transferSyntax: 'explicit', responses: [{ status: 0xff00, item }, { status: 0x0000 }] });
  assert.equal(result.acceptedTransferSyntax, '1.2.840.10008.1.2.1');
  assert.equal(observations.queryRetrieveLevel, 'STUDY');
  assert.equal(result.items[0].studyDescription, 'Synthetic MR brain');
});

test('Study Root reassembles fragmented command and dataset PDVs', async () => {
  const { result } = await queryScenario({ fragmented: true, responses: [{ status: 0xff00, item }, { status: 0x0000 }] });
  assert.equal(result.classification, 'SUCCESS_MATCHES');
  assert.equal(result.items[0].studyInstanceUid, '1.2.840.999.1');
});

test('Study Root waits for a later Identifier PDU for any dataset-present command value', async () => {
  const { result } = await queryScenario({ separateResponsePdus:true, responses:[{status:0xff00,item,datasetType:0x0001},{status:0x0000}] });
  assert.equal(result.classification,'SUCCESS_MATCHES');
  assert.equal(result.items.length,1);
  assert.equal(result.cfind.dicomStatus,'0x0000');
});

test('Study Root request elements are tag-ordered for strict peers', async () => {
  const { result, observations } = await queryScenario({ abortOnUnsorted:true, responses:[{status:0x0000}] }, { accessionNumber:'SYNTH-ACC',patientId:'SYNTH-ID' });
  assert.deepEqual(observations.requestTags,[...observations.requestTags].sort());
  assert.equal(result.classification,'SUCCESS_ZERO_MATCHES');
});

test('Study Root association identifies the Kairo implementation to strict peers', async () => {
  const { result, observations } = await queryScenario({ abortWithoutImplementationClass:true, responses:[{status:0x0000}] });
  assert.equal(observations.implementationClassUid,'2.25.25815942481606045106159218101014368293');
  assert.equal(result.classification,'SUCCESS_ZERO_MATCHES');
});

test('Study Root association rejection remains distinct from presentation-context rejection', async () => {
  const { result } = await queryScenario({ associationRejected: true });
  assert.equal(result.association.code, 'STUDY_ASSOCIATION_REJECTED');
  assert.equal(result.cfind.state, 'NOT_RUN');
});

test('Study Root terminal failure preserves completed lower layers and numeric status', async () => {
  const { result } = await queryScenario({ responses: [{ status: 0xa900 }] });
  assert.equal(result.tcp.code, 'TCP_CONNECTED');
  assert.equal(result.association.code, 'ASSOCIATION_ACCEPTED');
  assert.equal(result.cfind.code, 'C_FIND_IDENTIFIER_REJECTED');
  assert.equal(result.cfind.dicomStatus, '0xA900');
});

test('pending warning status preserves the study and surfaces separate warning evidence', async () => {
  const { result } = await queryScenario({ responses: [{ status: 0xff01, item }, { status: 0x0000 }] });
  assert.equal(result.classification, 'SUCCESS_MATCHES');
  assert.equal(result.items.length, 1);
  assert.ok(result.warnings.some(warning => warning.code === 'C_FIND_PENDING_WARNING'));
});

test('Study Root presentation-context rejection is distinct from C-FIND failure', async () => {
  const { result } = await queryScenario({ contextRejected: true });
  assert.equal(result.association.code, 'STUDY_PRESENTATION_CONTEXT_REJECTED');
  assert.equal(result.cfind.state, 'NOT_RUN');
});

test('malformed association and DIMSE responses fail safely without payload content', async () => {
  const association=(await queryScenario({malformedAssociation:true})).result;
  assert.equal(association.association.code,'STUDY_ASSOCIATION_MALFORMED'); assert.equal(association.cfind.state,'NOT_RUN');
  const dimse=(await queryScenario({malformedResponse:true})).result;
  assert.equal(dimse.cfind.code,'STUDY_DIMSE_MALFORMED'); assert.doesNotMatch(JSON.stringify(dimse),/SYNTH-ACC/);
});

test('A-ABORT after C-FIND is peer-abort evidence rather than malformed DIMSE', async () => {
  const {result}=await queryScenario({abortAfterFind:true});
  assert.equal(result.cfind.code,'PEER_ABORT'); assert.equal(result.association.code,'ASSOCIATION_ACCEPTED');
});

for (const charset of [
  { name: 'default repertoire', value: undefined, encoding: 'ascii', description: 'Synthetic study' },
  { name: 'ISO_IR 100', value: 'ISO_IR 100', encoding: 'latin1', description: 'Étude synthétique' },
  { name: 'ISO_IR 192', value: 'ISO_IR 192', encoding: 'utf8', description: '検査説明' }
]) test(`Study Root decodes ${charset.name}`, async () => {
  const study = { ...item, specificCharacterSet: charset.value, textEncoding: charset.encoding, studyDescription: charset.description };
  const { result } = await queryScenario({ responses: [{ status: 0xff00, item: study }, { status: 0x0000 }] });
  assert.equal(result.items[0].studyDescription, charset.description);
});

test('unsupported character set preserves protocol success without raw text leakage', async () => {
  const study = { ...item, specificCharacterSet: 'ISO_IR 999', studyDescription: 'PRIVATE-CANARY' };
  const { result } = await queryScenario({ responses: [{ status: 0xff00, item: study }, { status: 0x0000 }] });
  assert.equal(result.items[0].studyDescription, 'CHARACTER_SET_NOT_SUPPORTED');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE-CANARY|�/);
});

test('100 Study Root results trigger correlated C-CANCEL and retain the bounded set', async () => {
  const responses = Array.from({ length: 101 }, () => ({ status: 0xff00, item }));
  const { result, observations } = await queryScenario({ responses, cancelResponseStatus: 0xfe00 });
  assert.equal(result.classification, 'SUCCESS_TRUNCATED');
  assert.equal(result.items.length, 100);
  assert.equal(result.cancellation.code, 'CANCEL_CONFIRMED');
  assert.equal(observations.cancel.messageIdBeingRespondedTo, 1);
});
