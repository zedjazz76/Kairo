import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMwlRequest, emptyMwlState, mwlInspectorRows, normalizeMwlResult, todayLocal } from '../../hl7-toolkit/app/scripts/mwl-model.mjs';

const endpoint = (criteria = {}) => ({ host: '127.0.0.1', port: 104, callingAe: 'KAIRO', calledAe: 'MWL', timeoutMs: 3000, criteria });

test('uses the supplied workstation-local calendar date', () => assert.equal(todayLocal(new Date(2026, 8, 6, 23, 30)), '2026-09-06'));
test('rejects an unconstrained request and preserves an exact date', () => {
  assert.throws(() => buildMwlRequest(endpoint()), /MWL_CRITERION_REQUIRED/);
  assert.equal(buildMwlRequest(endpoint({ scheduledDate: '2026-09-06' })).criteria.scheduledDate, '20260906');
});
test('rejects invalid endpoint and procedure-code pairs', () => {
  assert.throws(() => buildMwlRequest({ ...endpoint({ modality: 'US' }), callingAe: 'TOO\\BAD' }), /MWL_CALLING_AE_INVALID/);
  assert.throws(() => buildMwlRequest(endpoint({ procedureCode: { value: 'US1' } })), /MWL_PROCEDURE_CODE_PAIR_REQUIRED/);
});
test('rejects oversized service results instead of silently dropping them', () => {
  assert.throws(() => normalizeMwlResult({ classification: 'SUCCESS_MATCHES', items: Array.from({ length: 101 }, () => ({})) }), /MWL_RESPONSE_LIMIT_VIOLATION/);
});
test('shows nested sequence paths from dictionary definitions', () => {
  const rows = mwlInspectorRows({ tags: [{ path: ['ScheduledProcedureStepSequence'], tag: '00400001', value: 'STATION' }] });
  assert.equal(rows[0].path, 'Scheduled Procedure Step Sequence → Scheduled Station AE Title');
  assert.equal(rows[0].keyword, 'ScheduledStationAETitle');
  assert.match(rows[0].definition, /scheduled station/i);
});
test('fresh empty state retains no previous result values', () => assert.deepEqual(emptyMwlState(), { result: null, items: [], selectedIndex: -1 }));
