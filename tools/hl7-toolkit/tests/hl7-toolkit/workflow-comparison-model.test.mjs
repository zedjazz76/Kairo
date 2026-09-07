import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWorkflowGuidance, clearWorkflowComparisonState, compareOrmToMwl } from '../../hl7-toolkit/app/scripts/workflow-comparison-model.mjs';

const evidence = (concept, role, path, value, datatype = 'ST') => ({ concept, role, path, value, datatype, components: [] });
const orm = values => ({ groupId: 'order-1', msh9: 'ORM^O01', segmentOccurrences: ['ORC[1]', 'OBR[1]'], values, accessionChoices: values.map(({ path, value }) => ({ path, value })) });
const mwlItem = overrides => ({ mode: 'SELECTED_ITEM_COMPARISON', generation: 1, query: { result: { classification: 'SUCCESS_MATCHES', matchCount: 1 } }, item: { patientId: '', accessionNumber: '', requestedProcedureId: '', requestedProcedureDescription: '', scheduledProcedureStep: {}, ...overrides } });

test('preserves separate agreeing and conflicting same-concept sources', () => {
  const agreeing = compareOrmToMwl({ orm: orm([evidence('ORDER', 'PLACER', 'ORC[1]-2', 'ABC', 'EI'), evidence('ORDER', 'PLACER', 'OBR[1]-2', 'ABC', 'EI')]), mwl: mwlItem({ requestedProcedureId: 'ABC' }), accessionSourcePath: '' });
  assert.deepEqual(agreeing.rows.filter(row => row.role === 'PLACER').map(row => row.hl7Source), ['ORC[1]-2', 'OBR[1]-2']);
  assert.equal(agreeing.concepts.find(item => item.concept === 'ORDER').state, 'CONSISTENT');
  const conflict = compareOrmToMwl({ orm: orm([evidence('ORDER', 'PLACER', 'ORC[1]-2', 'ABC', 'EI'), evidence('ORDER', 'PLACER', 'OBR[1]-2', 'XYZ', 'EI')]), mwl: mwlItem({ requestedProcedureId: 'ABC' }), accessionSourcePath: '' });
  assert.equal(conflict.concepts.find(item => item.concept === 'ORDER').state, 'AMBIGUOUS');
  assert.equal(conflict.rows.filter(row => row.role === 'PLACER').length, 2);
});

test('uses only the explicit accession source and never infers another field', () => {
  const source = orm([evidence('ORDER', 'FILLER', 'OBR[1]-3', 'ACC-1', 'EI'), evidence('ORDER', 'PLACER', 'ORC[1]-2', 'OTHER', 'EI')]);
  const absent = compareOrmToMwl({ orm: source, mwl: mwlItem({ accessionNumber: 'ACC-1' }), accessionSourcePath: '' });
  assert.equal(absent.rows.find(row => row.concept === 'ACCESSION').state, 'NOT_COMPARABLE');
  const selected = compareOrmToMwl({ orm: source, mwl: mwlItem({ accessionNumber: 'ACC-1' }), accessionSourcePath: 'OBR[1]-3' });
  assert.equal(selected.rows.find(row => row.concept === 'ACCESSION').state, 'MATCH');
  assert.equal(selected.rows.find(row => row.concept === 'ACCESSION').hl7Source, 'OBR[1]-3');
});

test('compares code plus system and keeps descriptions separate', () => {
  const source = orm([evidence('PROCEDURE', 'PROCEDURE_CODE', 'OBR[1]-4', '12345^MRI Brain^LOCAL', 'CE')]);
  const match = compareOrmToMwl({ orm: source, mwl: mwlItem({ requestedProcedureCode: { value: '12345', scheme: 'LOCAL' }, requestedProcedureDescription: 'MRI Brain' }), accessionSourcePath: '' });
  assert.equal(match.rows.find(row => row.role === 'PROCEDURE_CODE').state, 'MATCH');
  const mismatch = compareOrmToMwl({ orm: source, mwl: mwlItem({ requestedProcedureCode: { value: '12345', scheme: 'LOINC' }, requestedProcedureDescription: 'MRI Brain' }), accessionSourcePath: '' });
  assert.equal(mismatch.rows.find(row => row.role === 'PROCEDURE_CODE').state, 'MISMATCH');
  const noSystem = compareOrmToMwl({ orm: source, mwl: mwlItem({ requestedProcedureCode: { value: '12345', scheme: '' } }), accessionSourcePath: '' });
  assert.equal(noSystem.rows.find(row => row.role === 'PROCEDURE_CODE').state, 'NOT_COMPARABLE');
});

test('preserves composite identifier meaning and original values', () => {
  const source = orm([evidence('IDENTITY', 'PATIENT_ID', 'PID[1]-3', ' ID-1^^^AUTH^MR ', 'CX')]);
  const before = structuredClone(source);
  const result = compareOrmToMwl({ orm: source, mwl: mwlItem({ patientId: 'ID-1' }), accessionSourcePath: '' });
  const row = result.rows.find(item => item.concept === 'IDENTITY');
  assert.notEqual(row.state, 'MATCH');
  assert.equal(row.hl7Value, ' ID-1^^^AUTH^MR ');
  assert.deepEqual(source, before);
});

test('uses exact case and compatible date-time precision only', () => {
  const values = [evidence('MODALITY', 'MODALITY', 'OBR[1]-24', 'MR'), evidence('SCHEDULE', 'SCHEDULED_AT', 'OBR[1]-36', '202609071030', 'DTM')];
  const result = compareOrmToMwl({ orm: orm(values), mwl: mwlItem({ scheduledProcedureStep: { modality: 'mr', scheduledDate: '20260907', scheduledTime: '103000' } }), accessionSourcePath: '' });
  assert.equal(result.rows.find(row => row.concept === 'MODALITY').state, 'MISMATCH');
  assert.equal(result.rows.find(row => row.concept === 'SCHEDULE').state, 'MATCH');
  const incompatible = compareOrmToMwl({ orm: orm([evidence('SCHEDULE', 'SCHEDULED_AT', 'OBR[1]-36', '20260907', 'DTM')]), mwl: mwlItem({ scheduledProcedureStep: { scheduledDate: '20260907', scheduledTime: '103000' } }), accessionSourcePath: '' });
  assert.equal(incompatible.rows.find(row => row.concept === 'SCHEDULE').state, 'NOT_COMPARABLE');
});

test('zero-match mode compares criteria without inventing item missing rows', () => {
  const result = compareOrmToMwl({ orm: orm([evidence('MODALITY', 'MODALITY', 'OBR[1]-24', 'MR')]), mwl: { mode: 'ZERO_MATCH_QUERY_CONTEXT', generation: 2, item: null, query: { criteria: { modality: 'MR' }, result: { classification: 'SUCCESS_ZERO_MATCHES', cfind: { code: 'C_FIND_SUCCESS', dicomStatus: '0x0000' }, matchCount: 0 } } }, accessionSourcePath: '' });
  assert.equal(result.rows.find(row => row.concept === 'MODALITY').state, 'MATCH');
  assert.equal(result.rows.some(row => row.state === 'MISSING_IN_MWL'), false);
});

test('emits missing states only for established selected-item counterparts', () => {
  const missingHl7 = compareOrmToMwl({ orm: orm([]), mwl: mwlItem({ patientId: 'ID-1' }), accessionSourcePath: '' });
  assert.equal(missingHl7.rows.find(row => row.concept === 'IDENTITY').state, 'MISSING_IN_HL7');
  const missingMwl = compareOrmToMwl({ orm: orm([evidence('IDENTITY', 'PATIENT_ID', 'PID[1]-3', 'ID-1', 'CX')]), mwl: mwlItem({ patientId: '' }), accessionSourcePath: '' });
  assert.equal(missingMwl.rows.find(row => row.concept === 'IDENTITY').state, 'MISSING_IN_MWL');
});

test('clear state contains no retained sources or accession choice', () => {
  assert.deepEqual(clearWorkflowComparisonState(), { ormSource: null, groupId: '', accessionSourcePath: '', mwlTarget: null, comparison: null });
});

test('guidance is bounded, qualified, and excludes PHI canaries', () => {
  const guidance = buildWorkflowGuidance({ mode: 'ZERO_MATCH_QUERY_CONTEXT', rows: [], concepts: [], orm: orm([evidence('IDENTITY', 'PATIENT_ID', 'PID[1]-3', 'SYNTHETIC-PATIENT-CANARY')]), mwl: { query: { criteria: { accessionNumber: 'SYNTH-ACCESSION-CANARY' }, result: { classification: 'SUCCESS_ZERO_MATCHES', matchCount: 0 } } } });
  assert.match(guidance.observed.join(' '), /completed successfully.*zero/i);
  assert.ok(guidance.nextChecks.length >= 1 && guidance.nextChecks.length <= 3);
  assert.doesNotMatch(JSON.stringify(guidance), /SYNTHETIC-PATIENT-CANARY|SYNTH-ACCESSION-CANARY|root cause|proved|proves/i);
});
