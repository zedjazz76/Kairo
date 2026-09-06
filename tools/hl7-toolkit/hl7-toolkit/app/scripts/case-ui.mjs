import { createCase, addManualNote, attachDiagnostic, summarizeCase, formatHandoff } from './case-model.mjs';

export function mountCase(root, { now = () => new Date().toISOString() } = {}) {
  const $ = selector => root.querySelector(selector);
  let activeCase = null;
  const showError = () => { $('#case-evidence-status').textContent = 'Case content was not accepted. Remove patient-identifiable data, credentials, message content, secrets, or overlong text and try again.'; };
  const renderTimeline = () => {
    if (!activeCase?.timeline.length) { $('#case-timeline').textContent = 'No evidence attached.'; return; }
    $('#case-timeline').textContent = activeCase.timeline.map(item => `${item.timestamp} · ${item.source}${item.endpoint ? ` · ${item.endpoint}` : ''}\n${item.result}${item.observed.length ? `\n${item.observed.join(' ')}` : ''}${item.analystNote && item.evidenceType !== 'MANUAL_NOTE' ? `\nAnalyst note: ${item.analystNote}` : ''}`).join('\n\n');
  };
  $('#case-form').addEventListener('submit', event => event.preventDefault());
  $('#case-create').addEventListener('click', () => {
    if (!$('#case-form').reportValidity()) return;
    try {
      activeCase = createCase({ title: $('#case-title').value, system: $('#case-system').value, environment: $('#case-environment').value, issue: $('#case-issue').value, symptom: $('#case-symptom').value, status: $('#case-status').value, notes: $('#case-notes').value }, now());
      $('#case-active').textContent = `${activeCase.title} · ${activeCase.status} · ${activeCase.system} · ${activeCase.environment}`;
      $('#case-evidence-status').textContent = 'Active case created in this browser session.'; $('#case-handoff').value = ''; renderTimeline();
    } catch { showError(); }
  });
  $('#case-note-add').addEventListener('click', () => {
    if (!activeCase) { $('#case-evidence-status').textContent = 'Create an active case first.'; return; }
    try { activeCase = addManualNote(activeCase, $('#case-manual-note').value, now()); $('#case-manual-note').value = ''; $('#case-evidence-status').textContent = 'Manual note added to the case timeline.'; renderTimeline(); } catch { showError(); }
  });
  root.addEventListener('kairo:diagnostic-evidence', event => {
    if (!activeCase) { $('#case-evidence-status').textContent = 'Create an active case before attaching diagnostic evidence.'; return; }
    try { activeCase = attachDiagnostic(activeCase, event.detail, '', now()); $('#case-evidence-status').textContent = 'Current diagnostic added to the case timeline.'; renderTimeline(); } catch { showError(); }
  });
  $('#case-summary-run').addEventListener('click', () => {
    if (!activeCase) { $('#case-evidence-status').textContent = 'Create an active case first.'; return; }
    const summary = summarizeCase(activeCase);
    $('#case-summary-observed').textContent = 'OBSERVED: ' + summary.observed.join(' '); $('#case-summary-boundary').textContent = 'LIKELY BOUNDARY: ' + summary.likelyBoundary; $('#case-summary-missing').textContent = 'MISSING EVIDENCE: ' + summary.missingEvidence; $('#case-summary-next').textContent = 'NEXT CHECK: ' + summary.nextCheck;
  });
  $('#case-handoff-run').addEventListener('click', () => {
    if (!activeCase) { $('#case-evidence-status').textContent = 'Create an active case first.'; return; }
    $('#case-handoff').value = formatHandoff(activeCase, summarizeCase(activeCase)); $('#case-evidence-status').textContent = 'Handoff generated locally. Review it before using it elsewhere.';
  });
  renderTimeline();
}
