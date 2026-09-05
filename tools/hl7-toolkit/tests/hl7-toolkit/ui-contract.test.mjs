import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createWorkbenchState, selectMessage, editActiveMessage, undoActiveMessage, redoActiveMessage } from '../../hl7-toolkit/app/scripts/workbench.mjs';

test('workbench edits only the selected message and supports undo and redo', () => {
  const state = createWorkbenchState();
  state.messages = [
    { id: 'one', text: 'MSH|^~\\&|A|F|B|F|202609031200||ADT^A01|ONE|P|2.5.1\rPID|1||FIRST', undo: [], redo: [] },
    { id: 'two', text: 'MSH|^~\\&|A|F|B|F|202609031200||ADT^A01|TWO|P|2.5.1\rPID|1||SECOND', undo: [], redo: [] },
  ];
  selectMessage(state, 'two');
  editActiveMessage(state, { type: 'set-value', path: 'PID-3.1', value: 'EDITED' });
  assert.match(state.messages[0].text, /FIRST$/);
  assert.match(state.messages[1].text, /EDITED$/);
  undoActiveMessage(state);
  assert.match(state.messages[1].text, /SECOND$/);
  redoActiveMessage(state);
  assert.match(state.messages[1].text, /EDITED$/);
  assert.equal(state.activeId, 'two');
});

test('interface exposes named workspaces, explicit copying, and a one-message send panel', () => {
  const html = readFileSync('hl7-toolkit/app/index.html', 'utf8');
  for (const label of ['Quick Sanitize', 'Inspect', 'Compare', 'Validate', 'Send', 'History', 'Copy sanitized', 'Production']) {
    assert.ok(html.includes(label), `Missing accessible label: ${label}`);
  }
  assert.match(html, /One message at a time/);
  assert.doesNotMatch(html, /Batch Send|Start Listener|Auto Retry/i);
  const css = readFileSync('hl7-toolkit/app/styles/app.css', 'utf8');
  assert.match(css, /--text:\s*#f7fafc/i);
  assert.match(css, /:focus-visible/);
});

test('advanced catalog filtering exposes accessible apply, clear, and status controls', () => {
  const html = readFileSync('hl7-toolkit/app/index.html', 'utf8');
  for (const label of ['Advanced filters', 'Add condition', 'Apply filters', 'Clear filters']) {
    assert.ok(html.includes(label), `Missing filter control: ${label}`);
  }
  assert.match(html, /id="filter-status"[^>]*aria-live="polite"/);
  assert.match(html, /id="filter-error"[^>]*aria-live="assertive"/);
  assert.match(html, /id="filter-conditions"/);
});
