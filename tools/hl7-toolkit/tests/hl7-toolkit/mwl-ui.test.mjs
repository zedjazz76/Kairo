import assert from 'node:assert/strict';
import test from 'node:test';
import { mountMwl } from '../../hl7-toolkit/app/scripts/mwl-ui.mjs';

function harness() {
  const nodes = new Map();
  const makeNode = (tagName = '') => ({
    tagName: tagName.toUpperCase(),
    value: '', textContent: '', disabled: false, listeners: {}, children: [], dataset: {},
    reportValidity: () => true,
    addEventListener(type, listener) { this.listeners[type] = listener; },
    replaceChildren(...children) { this.children = children; },
    append(...children) { this.children.push(...children); }
  });
  return {
    nodes,
    root: {
      querySelector(selector) {
        if (!nodes.has(selector)) nodes.set(selector, makeNode());
        return nodes.get(selector);
      },
      createElement: makeNode
    },
    visibleText() {
      const collect = node => [node.textContent, ...node.children.flatMap(collect)].join(' ');
      return [...nodes.values()].map(collect).join(' ');
    }
  };
}

function endpoint(root) {
  for (const [id, value] of Object.entries({ host: 'pacs.test', port: '4242', timeout: '3000', calling: 'KAIRO', called: 'ORTHANC' })) root.querySelector('#mwl-' + id).value = value;
}

const layer = (state, code, dicomStatus = '') => ({ state, code, dicomStatus, detail: code, elapsedMs: 1 });
const zeroMatchResult = { classification: 'SUCCESS_ZERO_MATCHES', items: [], dns: layer('SUCCESS', 'RESOLVED'), tcp: layer('SUCCESS', 'TCP_CONNECTED'), association: layer('SUCCESS', 'ASSOCIATION_ACCEPTED'), cfind: layer('SUCCESS', 'C_FIND_SUCCESS', '0x0000'), matches: { state: 'SUCCESS', code: 'ZERO_MATCHES', retained: 0, truncated: false }, cancellation: layer('NOT_RUN', 'NOT_RUN'), warnings: [] };
const matchingResult = items => ({ ...zeroMatchResult, classification: 'SUCCESS_MATCHES', items, matches: { state: 'SUCCESS', code: 'MATCHES_RETAINED', retained: items.length, truncated: false } });

test('MWL form shows local date and sends nothing before explicit Run', () => {
  const { root } = harness();
  const requests = [];
  mountMwl(root, { request(path, request) { requests.push({ path, request }); } }, { now: () => new Date(2026, 8, 6, 10, 0) });
  assert.equal(root.querySelector('#mwl-scheduled-date').value, '2026-09-06');
  assert.equal(requests.length, 0);
});

test('clearing all visible criteria blocks locally', async () => {
  const { root } = harness();
  const requests = [];
  mountMwl(root, { request(path, request) { requests.push({ path, request }); } }, { now: () => new Date(2026, 8, 6, 10, 0) });
  for (const [id, value] of Object.entries({ host: '127.0.0.1', port: '104', timeout: '3000', calling: 'KAIRO', called: 'MWL' })) root.querySelector('#mwl-' + id).value = value;
  for (const id of ['scheduled-date', 'modality', 'station-ae', 'patient-id', 'accession', 'requested-procedure-id', 'requested-procedure-description', 'procedure-code', 'procedure-scheme', 'location']) root.querySelector('#mwl-' + id).value = '';
  await root.querySelector('#mwl-run').listeners.click();
  assert.equal(requests.length, 0);
  assert.match(root.querySelector('#mwl-status').textContent, /at least one query criterion/i);
});

test('explicit Run sends only visible criteria and suppresses a concurrent duplicate', async () => {
  const { root } = harness();
  const requests = []; let finish;
  const api = { request(path, request) { requests.push({ path, ...request }); return new Promise(resolve => { finish = resolve; }); } };
  mountMwl(root, api, { now: () => new Date(2026, 8, 6, 10, 0) });
  for (const [id, value] of Object.entries({ host: 'pacs.test', port: '4242', timeout: '3000', calling: 'KAIRO', called: 'ORTHANC', modality: 'CT', 'patient-id': 'SYNTHETIC-ID' })) root.querySelector('#mwl-' + id).value = value;
  const first = root.querySelector('#mwl-run').listeners.click();
  await root.querySelector('#mwl-run').listeners.click();
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0], { path: '/api/dicom/mwl/find', method: 'POST', body: { schema: 'kairo.mwl-query.v1', host: 'pacs.test', port: 4242, callingAe: 'KAIRO', calledAe: 'ORTHANC', timeoutMs: 3000, criteria: { scheduledDate: '20260906', modality: 'CT', patientId: 'SYNTHETIC-ID' } } });
  finish({ items: [] }); await first;
  assert.equal(root.querySelector('#mwl-run').disabled, false);
});

test('saved DICOM profile requires explicit fill and never runs a query', async () => {
  const { root } = harness();
  const requests = [];
  const profile = { id: 'orthanc-test', label: 'Orthanc Test', type: 'dicom', host: '100.64.0.10', port: 4242, callingAe: 'KAIRO', calledAe: 'ORTHANC', responseTimeoutMs: 2500 };
  mountMwl(root, { request: async (path, request) => { requests.push({ path, ...request }); return { profiles: [profile] }; } });
  await root.querySelector('#mwl-profile-load').listeners.click();
  root.querySelector('#mwl-profile-select').value = 'orthanc-test';
  assert.equal(root.querySelector('#mwl-host').value, '');
  root.querySelector('#mwl-profile-fill').listeners.click();
  assert.equal(root.querySelector('#mwl-host').value, '100.64.0.10');
  assert.equal(root.querySelector('#mwl-port').value, 4242);
  assert.equal(root.querySelector('#mwl-calling').value, 'KAIRO');
  assert.equal(root.querySelector('#mwl-called').value, 'ORTHANC');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, '/api/profiles/endpoint');
});

test('successful zero match is rendered as a completed query rather than a failure', async () => {
  const { root } = harness(); endpoint(root);
  mountMwl(root, { request: async () => zeroMatchResult });
  await root.querySelector('#mwl-run').listeners.click();
  assert.match(root.querySelector('#mwl-summary').textContent, /SUCCESS_ZERO_MATCHES.*0/);
  assert.match(root.querySelector('#mwl-layer-cfind').textContent, /0x0000.*C_FIND_SUCCESS/);
  assert.match(root.querySelector('#mwl-match-summary').textContent, /zero matches.*not a network failure/i);
});

test('truncation renders retained count and cancellation state separately', async () => {
  const { root } = harness(); endpoint(root);
  const result = { ...zeroMatchResult, classification: 'SUCCESS_TRUNCATED', items: Array.from({ length: 100 }, (_, index) => ({ patientName: `SYNTHETIC ${index}`, patientId: `ID-${index}`, tags: [] })), matches: { state: 'SUCCESS', code: 'MATCH_LIMIT_REACHED', retained: 100, truncated: true }, cancellation: layer('SUCCESS', 'CANCEL_CONFIRMED'), cfind: layer('SUCCESS', 'C_FIND_CANCELLED', '0xFE00') };
  mountMwl(root, { request: async () => result });
  await root.querySelector('#mwl-run').listeners.click();
  assert.match(root.querySelector('#mwl-match-summary').textContent, /Matches retained: 100.*Query truncated: YES.*CANCEL_CONFIRMED/);
  assert.match(root.querySelector('#mwl-summary').textContent, /SUCCESS_TRUNCATED/);
});

test('MWL matches render as seven separate cells in header order', async () => {
  const { root } = harness(); endpoint(root);
  const item = {
    patientName: 'TEST^MWL', patientId: 'KAIRO-MWL-001', accessionNumber: 'KAIROACC001',
    requestedProcedureDescription: 'Synthetic MRI',
    scheduledProcedureStep: { modality: 'MR', scheduledStationAe: 'KAIRO_MR', scheduledDate: '20260907', scheduledTime: '110000' },
    tags: []
  };
  mountMwl(root, { request: async () => matchingResult([item]) });
  await root.querySelector('#mwl-run').listeners.click();
  const row = root.querySelector('#mwl-results').children[0];
  assert.equal(row.tagName, 'TR');
  assert.deepEqual(row.children.map(cell => cell.tagName), Array(7).fill('TD'));
  assert.deepEqual(row.children.map(cell => cell.textContent), ['TEST^MWL', 'KAIRO-MWL-001', 'KAIROACC001', 'Synthetic MRI', 'MR', 'KAIRO_MR', '20260907 110000']);
  assert.equal(row.textContent, '', 'result row must not be one concatenated text string');
});

test('multiple MWL matches preserve the same seven-cell column order', async () => {
  const { root } = harness(); endpoint(root);
  const items = [
    { patientName: 'PATIENT^ONE', patientId: 'ID-1', accessionNumber: 'ACC-1', requestedProcedureDescription: 'Procedure 1', scheduledProcedureStep: { modality: 'CT', scheduledStationAe: 'CT_AE', scheduledDate: '20260907', scheduledTime: '090000' }, tags: [] },
    { patientName: 'PATIENT^TWO', patientId: 'ID-2', accessionNumber: 'ACC-2', requestedProcedureDescription: 'Procedure 2', scheduledProcedureStep: { modality: 'MR', scheduledStationAe: 'MR_AE', scheduledDate: '20260908', scheduledTime: '101500' }, tags: [] }
  ];
  mountMwl(root, { request: async () => matchingResult(items) });
  await root.querySelector('#mwl-run').listeners.click();
  const rows = root.querySelector('#mwl-results').children;
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => row.children.map(cell => cell.textContent)), [
    ['PATIENT^ONE', 'ID-1', 'ACC-1', 'Procedure 1', 'CT', 'CT_AE', '20260907 090000'],
    ['PATIENT^TWO', 'ID-2', 'ACC-2', 'Procedure 2', 'MR', 'MR_AE', '20260908 101500']
  ]);
});

test('selecting a result renders safe tag definitions and nested sequence paths', async () => {
  const { root } = harness(); endpoint(root);
  const item = { patientName: 'SYNTHETIC PATIENT', patientId: 'SYNTHETIC-ID', accessionNumber: '', requestedProcedureId: '', requestedProcedureDescription: '', scheduledProcedureStep: {}, tags: [
    { tag: '00100010', value: 'SYNTHETIC PATIENT', path: [] },
    { tag: '00400001', value: 'SYNTHETIC_AE', path: ['00400100'] }
  ] };
  mountMwl(root, { request: async () => matchingResult([item]) });
  await root.querySelector('#mwl-run').listeners.click();
  root.querySelector('#mwl-results').children[0].listeners.click();
  const rows = root.querySelector('#mwl-inspector').children;
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => row.children.map(cell => cell.tagName)), [Array(4).fill('TD'), Array(4).fill('TD')]);
  assert.deepEqual(rows[0].children.map(cell => cell.textContent), ['(0010,0010)', 'PatientName', 'SYNTHETIC PATIENT', 'Patient Name']);
  assert.match(rows[1].children[1].textContent, /Scheduled Procedure Step Sequence.*→.*Scheduled Station AE Title/);
});

test('remote MWL values remain literal text inside their own cells', async () => {
  const { root } = harness(); endpoint(root);
  const remoteText = '<img src=x onerror="alert(1)">';
  const item = { patientName: remoteText, patientId: 'SAFE-ID', accessionNumber: '', requestedProcedureDescription: '', scheduledProcedureStep: {}, tags: [{ tag: '00100010', value: remoteText, path: [] }] };
  mountMwl(root, { request: async () => matchingResult([item]) });
  await root.querySelector('#mwl-run').listeners.click();
  const resultCell = root.querySelector('#mwl-results').children[0].children[0];
  assert.equal(resultCell.textContent, remoteText);
  assert.deepEqual(resultCell.children, []);
  root.querySelector('#mwl-results').children[0].listeners.click();
  const inspectorValue = root.querySelector('#mwl-inspector').children[0].children[2];
  assert.equal(inspectorValue.textContent, remoteText);
  assert.deepEqual(inspectorValue.children, []);
});

test('decoding warnings render metadata without patient text', async () => {
  const { root } = harness(); endpoint(root);
  const warning = { code: 'CHARACTER_SET_NOT_SUPPORTED', tag: '0010,0010', keyword: 'PatientName', characterSet: 'ISO_IR 999' };
  mountMwl(root, { request: async () => ({ ...zeroMatchResult, classification: 'SUCCESS_MATCHES', items: [], warnings: [warning] }) });
  await root.querySelector('#mwl-run').listeners.click();
  assert.match(root.querySelector('#mwl-warnings').textContent, /CHARACTER_SET_NOT_SUPPORTED.*PatientName.*ISO_IR 999/);
  assert.doesNotMatch(root.querySelector('#mwl-warnings').textContent, /SYNTHETIC PATIENT/);
});

test('Clear MWL results removes patient values from table and inspector without an API call', async () => {
  const view = harness(); const { root } = view; endpoint(root); let requests = 0;
  const item = { patientName: 'SYNTHETIC PATIENT', patientId: 'SYNTHETIC-ID', tags: [{ tag: '00100010', value: 'SYNTHETIC PATIENT', path: [] }] };
  mountMwl(root, { request: async () => { requests += 1; return { ...zeroMatchResult, classification: 'SUCCESS_MATCHES', items: [item], matches: { state: 'SUCCESS', code: 'MATCHES_RETAINED', retained: 1, truncated: false } }; } });
  await root.querySelector('#mwl-run').listeners.click();
  root.querySelector('#mwl-results').children[0].listeners.click();
  root.querySelector('#mwl-clear').listeners.click();
  assert.doesNotMatch(view.visibleText(), /SYNTHETIC PATIENT|SYNTHETIC-ID/);
  assert.equal(requests, 1);
});
