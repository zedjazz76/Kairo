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

test('validation workspace exposes a session-only local profile loader', () => {
  const html = readFileSync('hl7-toolkit/app/index.html', 'utf8');
  assert.match(html, /Load local validation profile/);
  assert.match(html, /id="validation-profile-file"/);
  assert.match(html, /id="validation-profile-status"[^>]*aria-live="polite"/);
});

test('Diagnostics contains the explicit DICOM Modality Worklist form', () => {
  const html = readFileSync('hl7-toolkit/app/index.html', 'utf8');
  const diagnostics = html.match(/<section data-workspace="diagnostics"[\s\S]*?<section data-workspace="send"/)[0];
  for (const id of ['mwl-profile-select', 'mwl-host', 'mwl-port', 'mwl-calling', 'mwl-called', 'mwl-scheduled-date', 'mwl-modality', 'mwl-station-ae', 'mwl-patient-id', 'mwl-accession', 'mwl-requested-procedure-id', 'mwl-requested-procedure-description', 'mwl-procedure-code', 'mwl-procedure-scheme', 'mwl-location', 'mwl-run', 'mwl-clear']) {
    assert.match(diagnostics, new RegExp(`id="${id}"`), `Missing MWL control: ${id}`);
  }
  assert.match(diagnostics, /Run MWL C-FIND/);
  assert.match(diagnostics, /session-only/i);
  const app = readFileSync('hl7-toolkit/app/scripts/app.mjs', 'utf8');
  assert.match(app, /mountMwl\(document, api\)/);
});

test('MWL results and selected-item inspector expose aligned semantic table headers', () => {
  const html = readFileSync('hl7-toolkit/app/index.html', 'utf8');
  const results = html.match(/<table[^>]*id="mwl-results-table"[\s\S]*?<\/table>/)?.[0] ?? '';
  const inspector = html.match(/<table[^>]*id="mwl-inspector-table"[\s\S]*?<\/table>/)?.[0] ?? '';
  assert.deepEqual([...results.matchAll(/<th[^>]*>([^<]+)<\/th>/g)].map(match => match[1]), ['Patient Name', 'Patient ID', 'Accession', 'Requested Procedure', 'Modality', 'Scheduled Station AE', 'Scheduled Date / Time']);
  assert.deepEqual([...inspector.matchAll(/<th[^>]*>([^<]+)<\/th>/g)].map(match => match[1]), ['Tag', 'Keyword', 'Value', 'Definition']);
  assert.match(results, /<tbody id="mwl-results"><\/tbody>/);
  assert.match(inspector, /<tbody id="mwl-inspector"><\/tbody>/);
});
