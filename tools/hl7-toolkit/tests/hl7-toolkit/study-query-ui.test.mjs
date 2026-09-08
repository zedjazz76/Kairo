import assert from 'node:assert/strict';
import test from 'node:test';
import { mountStudyQuery } from '../../hl7-toolkit/app/scripts/study-query-ui.mjs';

function harness() {
  const nodes = new Map();
  const makeNode = (tagName = '') => ({ tagName: tagName.toUpperCase(), value: '', textContent: '', disabled: false, listeners: {}, children: [], dataset: {},
    addEventListener(type, listener) { this.listeners[type] = listener; }, replaceChildren(...children) { this.children = children; }, append(...children) { this.children.push(...children); } });
  return { nodes, root: { querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, makeNode()); return nodes.get(selector); }, createElement: makeNode }, visibleText() { const collect = node => [node.textContent, ...node.children.flatMap(collect)].join(' '); return [...nodes.values()].map(collect).join(' '); } };
}

function endpoint(root) { for (const [id, value] of Object.entries({ host: 'pacs.test', port: '4242', timeout: '3000', calling: 'KAIRO', called: 'PACS' })) root.querySelector('#study-' + id).value = value; }
const layer = (state, code, dicomStatus = '') => ({ state, code, dicomStatus, detail: code, elapsedMs: 1 });
const zero = { classification: 'SUCCESS_ZERO_MATCHES', items: [], dns: layer('SUCCESS','RESOLVED'), tcp: layer('SUCCESS','TCP_CONNECTED'), association: layer('SUCCESS','ASSOCIATION_ACCEPTED'), cfind: layer('SUCCESS','C_FIND_SUCCESS','0x0000'), matches: { state:'SUCCESS',code:'ZERO_MATCHES',retained:0,truncated:false }, cancellation: layer('NOT_RUN','NOT_RUN'), warnings: [] };

test('Study Query starts blank and sends nothing before explicit Run', () => {
  const { root } = harness(); const requests = []; mountStudyQuery(root, { request(path, options) { requests.push({ path, options }); } });
  for (const id of ['accession','patient-id','study-uid','study-date','study-date-start','study-date-end','modalities']) assert.equal(root.querySelector('#study-' + id).value, '');
  assert.equal(requests.length, 0);
});

test('unconstrained Study Query is blocked locally with zero API calls', async () => {
  const { root } = harness(); const requests = []; endpoint(root); mountStudyQuery(root, { request(path, options) { requests.push({ path, options }); } });
  await root.querySelector('#study-run').listeners.click();
  assert.equal(requests.length, 0); assert.match(root.querySelector('#study-status').textContent, /STUDY_CRITERION_REQUIRED/);
});

test('explicit Run sends only visible criteria and suppresses a duplicate', async () => {
  const { root } = harness(); endpoint(root); root.querySelector('#study-accession').value = 'SYNTH-ACC'; let finish; const requests = [];
  mountStudyQuery(root, { request(path, options) { requests.push({ path, options }); return new Promise(resolve => { finish = resolve; }); } });
  const first = root.querySelector('#study-run').listeners.click(); await root.querySelector('#study-run').listeners.click();
  assert.equal(requests.length, 1); assert.equal(requests[0].path, '/api/dicom/studies/find'); assert.deepEqual(requests[0].options.body.criteria, { accessionNumber: 'SYNTH-ACC' });
  finish(zero); await first; assert.equal(root.querySelector('#study-run').disabled, false);
});

test('successful zero matches and actual status render as completed evidence', async () => {
  const { root } = harness(); endpoint(root); root.querySelector('#study-accession').value = 'NONE'; mountStudyQuery(root, { request: async () => zero });
  await root.querySelector('#study-run').listeners.click();
  assert.match(root.querySelector('#study-summary').textContent, /SUCCESS_ZERO_MATCHES/); assert.match(root.querySelector('#study-layer-cfind').textContent, /0x0000/); assert.match(root.querySelector('#study-match-summary').textContent, /not a PACS connectivity failure/i);
});

test('matching studies use seven cells and selected row renders four-cell provenance', async () => {
  const view = harness(), { root } = view; endpoint(root); root.querySelector('#study-patient-id').value = 'SYNTH-ID';
  const item = { patientName:'TEST^PATIENT',patientId:'SYNTH-ID',accessionNumber:'ACC',studyDate:'20260907',modalitiesInStudy:'MR',studyDescription:'Synthetic study',studyInstanceUid:'1.2.3',tags:[{tag:'0020000D',value:'1.2.3',path:[]}] };
  mountStudyQuery(root, { request: async () => ({ ...zero, classification:'SUCCESS_MATCHES',items:[item],matches:{state:'SUCCESS',code:'MATCHES_RETAINED',retained:1,truncated:false} }) });
  await root.querySelector('#study-run').listeners.click(); const row = root.querySelector('#study-results').children[0];
  assert.deepEqual(row.children.map(cell => cell.textContent), ['TEST^PATIENT','SYNTH-ID','ACC','20260907','MR','Synthetic study','1.2.3']);
  row.listeners.click(); assert.deepEqual(root.querySelector('#study-inspector').children[0].children.map(cell => cell.textContent), ['(0020,000D)','StudyInstanceUID','1.2.3','Unique identifier for the Study.']);
});

test('Clear results removes PHI and retained state without an API call', async () => {
  const view = harness(), { root } = view; endpoint(root); root.querySelector('#study-patient-id').value='SYNTH-ID'; let calls=0;
  const item={patientName:'TEST^PATIENT',patientId:'SYNTH-ID',accessionNumber:'',studyDate:'',modalitiesInStudy:'',studyDescription:'',studyInstanceUid:'',tags:[{tag:'00100010',value:'TEST^PATIENT',path:[]}]};
  const controller=mountStudyQuery(root,{request:async()=>{calls++;return{...zero,classification:'SUCCESS_MATCHES',items:[item],matches:{state:'SUCCESS',code:'MATCHES_RETAINED',retained:1,truncated:false}};}});
  await root.querySelector('#study-run').listeners.click(); root.querySelector('#study-results').children[0].listeners.click(); root.querySelector('#study-clear').listeners.click();
  assert.doesNotMatch(view.visibleText(), /TEST\^PATIENT/); assert.equal(calls,1); assert.equal(controller.getState().result,null);
});
