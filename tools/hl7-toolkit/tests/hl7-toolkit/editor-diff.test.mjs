import assert from 'node:assert/strict';
import test from 'node:test';
import { getValue, parseHl7, serializeHl7 } from '../../hl7-toolkit/app/scripts/hl7-parser.mjs';
import { applyEdit, undoEdit } from '../../hl7-toolkit/app/scripts/editor.mjs';
import { exactDiff, semanticDiff } from '../../hl7-toolkit/app/scripts/diff.mjs';

const header = 'MSH|^~\\&|A|F|B|F|202609031200||ORM^O01|ONE|P|2.5.1\r';

test('edits one path without changing untouched elements and undo restores exact content', () => {
  const message = parseHl7(header + 'PID|1||MRN-0001^^^AUTH^MR\rZXY|1|UNCHANGED');
  const receipt = applyEdit(message, { type: 'set-value', path: 'PID-3.1', value: 'MRN-0002' });
  assert.equal(getValue(message, 'PID-3.1'), 'MRN-0001');
  assert.equal(getValue(receipt.message, 'PID-3.1'), 'MRN-0002');
  assert.equal(getValue(receipt.message, 'PID-3.4'), 'AUTH');
  assert.match(receipt.after, /ZXY\|1\|UNCHANGED$/);
  assert.equal(serializeHl7(undoEdit(receipt)), serializeHl7(message));
  assert.throws(() => applyEdit(message, { type: 'set-value', path: 'PID-3.1', value: 'BAD|FIELD' }), /STRUCTURAL_DELIMITER/);
});

test('add, clone, move, and remove segment actions retain valid segment boundaries', () => {
  const message = parseHl7(header + 'PID|1||MRN-0001');
  const added = applyEdit(message, { type: 'add-segment', index: 2, value: 'NTE|1||SYNTHETIC' }).message;
  const cloned = applyEdit(added, { type: 'clone-segment', index: 2 }).message;
  assert.equal(cloned.segments.filter(({ name }) => name === 'NTE').length, 2);
  const moved = applyEdit(cloned, { type: 'move-segment', index: 3, toIndex: 1 }).message;
  assert.deepEqual(moved.segments.map(({ name }) => name), ['MSH', 'NTE', 'PID', 'NTE']);
  const removed = applyEdit(moved, { type: 'remove-segment', index: 1 }).message;
  assert.deepEqual(removed.segments.map(({ name }) => name), ['MSH', 'PID', 'NTE']);
});

test('semantic diff ignores only explicitly selected paths and their descendants', () => {
  const left = parseHl7(header + 'PID|1||MRN-0001');
  const right = parseHl7(header.replace('202609031200', '202609031205').replace('|ONE|', '|RIGHT|') + 'PID|1||MRN-0002');
  const changes = semanticDiff(left, right, { ignoredPaths: ['MSH-7', 'MSH-10'] });
  assert.deepEqual(changes.map(({ path }) => path), ['PID-3.1']);
  assert.equal(changes[0].before, 'MRN-0001');
  assert.equal(changes[0].after, 'MRN-0002');
  assert.equal(semanticDiff(left, right).length, 3);
});

test('exact comparison exposes terminator and framing differences without normalization', () => {
  assert.deepEqual(exactDiff('ABC\rDEF', 'ABC\r\nDEF'), [{ kind: 'added', leftStart: 4, leftEnd: 4, rightStart: 4, rightEnd: 5, before: '', after: '\n' }]);
  assert.equal(exactDiff('SAME', 'SAME').length, 0);
  assert.equal(exactDiff('MSH|A', '\u000bMSH|A\u001c\r')[0].after, '\u000bMSH|A\u001c\r');
});
