import assert from 'node:assert/strict';
import test from 'node:test';
import { mountWorkflowComparison } from '../../hl7-toolkit/app/scripts/workflow-comparison-ui.mjs';

function harness() {
  const nodes = new Map();
  const makeNode = tag => ({ tagName: (tag ?? '').toUpperCase(), value: '', textContent: '', hidden: false, disabled: false, children: [], listeners: {}, className: '', dataset: {}, addEventListener(type, listener) { this.listeners[type] = listener; }, replaceChildren(...children) { this.children = children; }, append(...children) { this.children.push(...children); }, setAttribute() {} });
  return { root: { querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, makeNode()); return nodes.get(selector); }, createElement: makeNode }, nodes };
}

const ormText = ['MSH|^~\\&|A|F|B|F|202609071000||ORM^O01|1|P|2.5.1', 'PID|1||ID-1', 'ORC|NW|P1|F1', 'OBR|1|P1|F1|123^MRI^LOCAL'].join('\r');
const layer = code => ({ state: 'SUCCESS', code });
const mwlSnapshot = (items, selectedIndex = -1) => ({ generation: 1, request: { host: 'mwl.test', port: 104, callingAe: 'KAIRO', calledAe: 'MWL', criteria: { scheduledDate: '20260907' } }, result: { classification: items.length ? 'SUCCESS_MATCHES' : 'SUCCESS_ZERO_MATCHES', items, dns: layer('RESOLVED'), tcp: layer('TCP_CONNECTED'), association: layer('ASSOCIATION_ACCEPTED'), cfind: { ...layer('C_FIND_SUCCESS'), dicomStatus: '0x0000' }, matches: { retained: items.length, truncated: false } }, selectedIndex });

function source(initialOrm, initialMwl) {
  let orm = initialOrm, mwl = initialMwl; const ormListeners = [], mwlListeners = [];
  return { hl7Source: { getSelectedMessageSnapshot: () => structuredClone(orm), onSelectedMessageChange: listener => ormListeners.push(listener) }, mwlSource: { getComparisonSnapshot: () => structuredClone(mwl), onComparisonSourceChange: listener => mwlListeners.push(listener) }, setOrm(value) { orm = value; ormListeners.forEach(listener => listener({ generation: value?.generation ?? 0, reason: 'MESSAGE_SELECTED' })); }, setMwl(value) { mwl = value; mwlListeners.forEach(listener => listener({ generation: value?.generation ?? 0, reason: 'RESULT_REPLACED' })); } };
}

test('requires explicit ORM and MWL selection and compares only on click', () => {
  const { root } = harness();
  const sources = source({ generation: 1, id: 'orm-1', index: 0, type: 'ORM^O01', text: ormText }, mwlSnapshot([{ patientId: 'ID-1', accessionNumber: 'F1', requestedProcedureCode: { value: '123', scheme: 'LOCAL' }, scheduledProcedureStep: {}, tags: [] }], 0));
  const controller = mountWorkflowComparison(root, sources);
  assert.equal(controller.getState().comparison, null);
  root.querySelector('#workflow-use-orm').listeners.click();
  root.querySelector('#workflow-use-mwl').listeners.click();
  assert.equal(controller.getState().comparison, null);
  root.querySelector('#workflow-compare').listeners.click();
  assert.ok(controller.getState().comparison.rows.length > 0);
  assert.equal(root.querySelector('#workflow-comparison-rows').children[0].children.length, 6);
  assert.match(root.querySelector('#workflow-mwl-target').textContent, /Selected worklist item/);
});

test('rejects non-ORM and supports successful zero-match without an item', () => {
  const { root } = harness();
  const nonOrm = ormText.replace('ORM^O01', 'ADT^A01');
  const sources = source({ generation: 1, id: 'adt', index: 0, type: 'ADT^A01', text: nonOrm }, mwlSnapshot([]));
  mountWorkflowComparison(root, sources);
  root.querySelector('#workflow-use-orm').listeners.click();
  assert.match(root.querySelector('#workflow-status').textContent, /ORM_REQUIRED/);
  sources.setOrm({ generation: 2, id: 'orm', index: 1, type: 'ORM^O01', text: ormText });
  root.querySelector('#workflow-use-orm').listeners.click();
  root.querySelector('#workflow-use-mwl').listeners.click();
  root.querySelector('#workflow-compare').listeners.click();
  assert.match(root.querySelector('#workflow-mwl-target').textContent, /Successful zero-match query context/);
  assert.equal(root.querySelector('#workflow-comparison-rows').children.some(row => row.children[5].textContent === 'MISSING_IN_MWL'), false);
});

test('source changes invalidate without recomputing and Clear retains ORM group', () => {
  const { root } = harness();
  const sources = source({ generation: 1, id: 'orm-1', index: 0, type: 'ORM^O01', text: ormText }, mwlSnapshot([], -1));
  const controller = mountWorkflowComparison(root, sources);
  root.querySelector('#workflow-use-orm').listeners.click(); root.querySelector('#workflow-use-mwl').listeners.click(); root.querySelector('#workflow-compare').listeners.click();
  const groupId = controller.getState().groupId;
  sources.setMwl(null);
  assert.equal(controller.getState().comparison, null);
  assert.equal(controller.getState().mwlTarget, null);
  root.querySelector('#workflow-clear').listeners.click();
  assert.equal(controller.getState().groupId, groupId);
  assert.equal(controller.getState().accessionSourcePath, '');
});
