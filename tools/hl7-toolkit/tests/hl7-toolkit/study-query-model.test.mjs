import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStudyQueryRequest, emptyStudyQueryState, normalizeStudyQueryResult, studyInspectorRows } from '../../hl7-toolkit/app/scripts/study-query-model.mjs';

const endpoint = (criteria = {}) => ({ schema: 'kairo.study-query.v1', host: '127.0.0.1', port: 104, callingAe: 'KAIRO', calledAe: 'PACS', timeoutMs: 3000, criteria });

test('requires one visible study criterion and adds none', () => {
  assert.throws(() => buildStudyQueryRequest(endpoint()), /STUDY_CRITERION_REQUIRED/);
  assert.deepEqual(buildStudyQueryRequest(endpoint({ accessionNumber: 'SYNTH-ACC' })).criteria, { accessionNumber: 'SYNTH-ACC' });
});

test('builds only approved exact study criteria', () => {
  const request = buildStudyQueryRequest(endpoint({ patientId: 'SYNTH-ID', studyInstanceUid: '1.2.840.1', studyDate: '2026-09-07', modalitiesInStudy: 'MR' }));
  assert.deepEqual(request.criteria, { patientId: 'SYNTH-ID', studyInstanceUid: '1.2.840.1', studyDate: '20260907', modalitiesInStudy: 'MR' });
  assert.equal(request.queryRetrieveLevel, undefined);
});

test('validates endpoint, dates, UID, wildcard, whitespace, lengths and unknown keys', () => {
  assert.throws(() => buildStudyQueryRequest({ ...endpoint({ accessionNumber: 'A' }), callingAe: 'bad\\ae' }), /STUDY_CALLING_AE_INVALID/);
  assert.throws(() => buildStudyQueryRequest(endpoint({ studyDate: '2026-99-07' })), /STUDY_DATE_INVALID/);
  assert.throws(() => buildStudyQueryRequest(endpoint({ studyDateRange: { start: '2026-09-08', end: '2026-09-07' } })), /STUDY_DATE_RANGE_INVALID/);
  assert.throws(() => buildStudyQueryRequest(endpoint({ studyInstanceUid: '1.2.BAD' })), /STUDY_UID_INVALID/);
  assert.throws(() => buildStudyQueryRequest(endpoint({ accessionNumber: 'ACC*' })), /STUDY_WILDCARD_NOT_SUPPORTED/);
  assert.throws(() => buildStudyQueryRequest(endpoint({ patientId: ' ID ' })), /STUDY_CRITERION_INVALID/);
  assert.throws(() => buildStudyQueryRequest(endpoint({ accessionNumber: 'A'.repeat(17) })), /STUDY_CRITERION_INVALID/);
  assert.throws(() => buildStudyQueryRequest({ ...endpoint({ accessionNumber: 'A' }), extra: true }), /STUDY_INPUT_REJECTED/);
  assert.throws(() => buildStudyQueryRequest(endpoint({ accessionNumber: ['A'] })), /STUDY_CRITERION_INVALID/);
});

test('normalizes only an allowlisted bounded result and preserves original values', () => {
  const item = { patientName: '  TEST^PATIENT  ', patientId: 'ID', accessionNumber: 'ACC', tags: [{ tag: '00100010', value: '  TEST^PATIENT  ', path: [] }] };
  const result = normalizeStudyQueryResult({ classification: 'SUCCESS_MATCHES', items: [item], warnings: [] });
  assert.equal(result.items[0].patientName, '  TEST^PATIENT  ');
  assert.throws(() => normalizeStudyQueryResult({ classification: 'SUCCESS_MATCHES', items: Array.from({ length: 101 }, () => ({})) }), /STUDY_RESPONSE_LIMIT_VIOLATION/);
});

test('renders provenance-controlled inspector rows', () => {
  const rows = studyInspectorRows({ tags: [{ tag: '0020000D', value: '1.2.3', path: [] }] });
  assert.deepEqual(rows[0], { path: 'Study Instance UID', tag: '(0020,000D)', keyword: 'StudyInstanceUID', value: '1.2.3', definition: 'Unique identifier for the Study.' });
});

test('fresh empty state contains no prior patient-bearing values', () => {
  const state = emptyStudyQueryState();
  assert.deepEqual(state, { result: null, request: null, items: [], selectedIndex: -1 });
  assert.doesNotMatch(JSON.stringify(state), /PATIENT|ACCESSION/);
});
