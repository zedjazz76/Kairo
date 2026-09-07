import assert from 'node:assert/strict';
import test from 'node:test';
import { projectMwlTarget } from '../../hl7-toolkit/app/scripts/mwl-workflow-adapter.mjs';

const layer = (code, status = '') => ({ state: 'SUCCESS', code, dicomStatus: status });
const request = { host: 'mwl.test', port: 104, callingAe: 'KAIRO', calledAe: 'MWL', criteria: { accessionNumber: 'ACC-1', scheduledDate: '20260907' } };
const item = id => ({ patientId: id, accessionNumber: 'ACC-1', tags: [{ tag: '00400001', path: ['00400100'], value: 'MR_AE' }], scheduledProcedureStep: { modality: 'MR', scheduledStationAe: 'MR_AE' } });
const result = (classification, items) => ({ classification, items, dns: layer('RESOLVED'), tcp: layer('TCP_CONNECTED'), association: layer('ASSOCIATION_ACCEPTED'), cfind: layer('C_FIND_SUCCESS', '0x0000'), matches: { retained: items.length, truncated: false } });

test('requires explicit current item selection and projects only that item', () => {
  const snapshot = { generation: 2, request, result: result('SUCCESS_MATCHES', [item('ID-1'), item('ID-2')]), selectedIndex: -1 };
  assert.equal(projectMwlTarget(snapshot).state, 'MWL_ITEM_SELECTION_REQUIRED');
  const selected = projectMwlTarget({ ...snapshot, selectedIndex: 1 });
  assert.equal(selected.mode, 'SELECTED_ITEM_COMPARISON');
  assert.equal(selected.item.patientId, 'ID-2');
  assert.match(selected.item.tags[0].path.join(' → '), /00400100/);
});

test('projects only an actual successful zero-match query context', () => {
  const snapshot = { generation: 3, request, result: result('SUCCESS_ZERO_MATCHES', []), selectedIndex: -1 };
  const projected = projectMwlTarget(snapshot);
  assert.equal(projected.mode, 'ZERO_MATCH_QUERY_CONTEXT');
  assert.equal(projected.item, null);
  assert.equal(projected.query.criteria.accessionNumber, 'ACC-1');
  assert.equal(projected.query.result.cfind.dicomStatus, '0x0000');
  assert.equal(projected.query.result.matchCount, 0);
});

test('rejects absent, failed, truncated, and inconsistent zero-match contexts', () => {
  assert.equal(projectMwlTarget(null).state, 'MWL_RESULT_REQUIRED');
  assert.equal(projectMwlTarget({ generation: 1, request, result: result('TCP_FAILURE', []), selectedIndex: -1 }).state, 'MWL_RESULT_REQUIRED');
  assert.equal(projectMwlTarget({ generation: 1, request, result: { ...result('SUCCESS_ZERO_MATCHES', []), matches: { retained: 0, truncated: true } }, selectedIndex: -1 }).state, 'MWL_RESULT_REQUIRED');
  assert.equal(projectMwlTarget({ generation: 1, request, result: result('SUCCESS_ZERO_MATCHES', [item('ID-1')]), selectedIndex: -1 }).state, 'MWL_RESULT_REQUIRED');
});

test('returns cloned projections that cannot mutate the source snapshot', () => {
  const snapshot = { generation: 4, request, result: result('SUCCESS_MATCHES', [item('ID-1')]), selectedIndex: 0 };
  const projected = projectMwlTarget(snapshot);
  projected.item.patientId = 'CHANGED';
  assert.equal(snapshot.result.items[0].patientId, 'ID-1');
});
