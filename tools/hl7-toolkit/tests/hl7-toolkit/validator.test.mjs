import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHl7 } from '../../hl7-toolkit/app/scripts/hl7-parser.mjs';
import { hashMessage, summarizeSendPreflight, validateBasic } from '../../hl7-toolkit/app/scripts/validator.mjs';
import { createWorkbenchState, editActiveMessage, selectMessage } from '../../hl7-toolkit/app/scripts/workbench.mjs';

const header = 'MSH|^~\\&|A|F|B|F|202609031200||ORM^O01|CTRL-1|P|2.5.1\r';

test('distinguishes required errors, timestamp warnings, and unknown coverage', () => {
  const findings = validateBasic(parseHl7('MSH|^~\\&|A|F|B|F|BADDATE||ORM^O01||P|\rZXY|1'));
  assert.ok(findings.some(({ code, severity }) => code === 'MSH_10_REQUIRED' && severity === 'error'));
  assert.ok(findings.some(({ code }) => code === 'MSH_12_REQUIRED'));
  assert.ok(findings.some(({ code }) => code === 'TIMESTAMP_SYNTAX'));
  assert.ok(findings.some(({ code, severity }) => code === 'UNKNOWN_SEGMENT' && severity === 'not-evaluated'));
});

test('validates real calendar ranges, numeric values, escapes, and duplicate control IDs', () => {
  const source = header.replace('202609031200', '202602301200') + 'PID|1||MRN-1\rOBX|1|NM|VALUE||NOT-NUMERIC\rNTE|1||Unclosed\\escape';
  const findings = validateBasic(parseHl7(source), { controlIds: new Map([['CTRL-1', 2]]) });
  for (const code of ['TIMESTAMP_SYNTAX', 'NUMBER_SYNTAX', 'UNBALANCED_ESCAPE', 'DUPLICATE_CONTROL_ID']) assert.ok(findings.some((finding) => finding.code === code), code);
  const valid = validateBasic(parseHl7(header + 'OBX|1|NM|VALUE||-12.5'));
  assert.equal(valid.filter(({ severity }) => ['warning', 'error'].includes(severity)).length, 0);
});

test('one-message framing restrictions cannot be overridden but ordinary findings can', () => {
  const findings = validateBasic(parseHl7(header + header));
  const boundary = findings.find(({ code }) => code === 'ONE_MESSAGE_REQUIRED');
  assert.equal(boundary.overridable, false);
  assert.equal(summarizeSendPreflight(findings, findings.map(({ id }) => id)).ready, false);
  const warnings = validateBasic(parseHl7(header.replace('|CTRL-1|', '||')));
  assert.equal(summarizeSendPreflight(warnings).ready, false);
  assert.equal(summarizeSendPreflight(warnings, warnings.map(({ id }) => id)).ready, true);
});

test('message fingerprints change on edit and prior acknowledgements are cleared', async () => {
  const state = createWorkbenchState();
  state.messages = [{ id: 'one', text: header, undo: [], redo: [] }];
  selectMessage(state, 'one');
  state.acknowledgedFindingIds = ['warning-old'];
  const before = await hashMessage(header);
  editActiveMessage(state, { type: 'set-value', path: 'MSH-10', value: 'CTRL-2' });
  assert.notEqual(await hashMessage(state.messages[0].text), before);
  assert.equal(before.length, 64);
  assert.deepEqual(state.acknowledgedFindingIds, []);
});
