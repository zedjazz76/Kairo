import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { mountCase } from '../../hl7-toolkit/app/scripts/case-ui.mjs';

test('case workspace creates a case, records a note and diagnostic, then renders guidance and handoff', async () => {
  const html = await readFile(new URL('../../hl7-toolkit/app/index.html', import.meta.url), 'utf8');
  assert.match(html, /data-nav="case"/); assert.match(html, /data-workspace="case"/);
  const nodes = new Map(), listeners = {};
  const makeNode = () => ({ value: '', textContent: '', listeners: {}, reportValidity: () => true, addEventListener(type, fn) { this.listeners[type] = fn; } });
  const root = { querySelector(selector) { assert.ok(html.includes(`id="${selector.slice(1)}"`), selector); if (!nodes.has(selector)) nodes.set(selector, makeNode()); return nodes.get(selector); }, addEventListener(type, fn) { listeners[type] = fn; } };
  mountCase(root, { now: () => '2026-09-06T16:00:00.000Z' });
  for (const [id, value] of Object.entries({ title: 'PACS worklist issue', system: 'Merge PACS / DMWL', environment: 'Test', issue: 'Orders are visible upstream but absent from worklist.', symptom: 'Expected item is absent.', status: 'INVESTIGATING', notes: 'Synthetic test context only.' })) root.querySelector('#case-' + id).value = value;
  root.querySelector('#case-create').listeners.click();
  assert.match(root.querySelector('#case-active').textContent, /PACS worklist issue.*INVESTIGATING/);
  root.querySelector('#case-manual-note').value = 'Receiver team confirmed the test destination.';
  root.querySelector('#case-note-add').listeners.click();
  listeners['kairo:diagnostic-evidence']({ detail: { type: 'dicom', timestamp: '2026-09-06T15:59:00.000Z', endpoint: 'pacs.test:4242', classification: 'ASSOCIATION_REJECTED', observed: ['TCP: TCP_CONNECTED.', 'DICOM association: ASSOCIATION_REJECTED.'], baselineChanges: ['DICOM association changed: ASSOCIATION_ACCEPTED → ASSOCIATION_REJECTED.'], likelyBoundary: 'AE configuration is the best-supported boundary.', missingEvidence: 'Receiver policy is missing.', nextCheck: 'Verify Called AE and Calling AE.' } });
  assert.match(root.querySelector('#case-timeline').textContent, /Analyst note[\s\S]*Receiver team[\s\S]*DICOM diagnostic[\s\S]*ASSOCIATION_REJECTED/);
  root.querySelector('#case-summary-run').listeners.click();
  assert.match(root.querySelector('#case-summary-observed').textContent, /OBSERVED:.*TCP_CONNECTED/);
  assert.match(root.querySelector('#case-summary-boundary').textContent, /LIKELY BOUNDARY:.*best-supported/);
  assert.match(root.querySelector('#case-summary-missing').textContent, /MISSING EVIDENCE:.*Receiver policy/);
  assert.match(root.querySelector('#case-summary-next').textContent, /NEXT CHECK:.*Called AE/);
  root.querySelector('#case-handoff-run').listeners.click();
  assert.match(root.querySelector('#case-handoff').value, /CASE:[\s\S]*PACS worklist issue[\s\S]*TESTS PERFORMED:[\s\S]*DICOM diagnostic[\s\S]*STATUS:[\s\S]*INVESTIGATING/);
});
