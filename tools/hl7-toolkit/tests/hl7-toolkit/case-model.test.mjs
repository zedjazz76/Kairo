import assert from 'node:assert/strict';
import test from 'node:test';
import { createCase, addManualNote, attachDiagnostic, summarizeCase, formatHandoff } from '../../hl7-toolkit/app/scripts/case-model.mjs';

const createdAt = '2026-09-06T15:00:00.000Z';
const caseFields = {
  title: 'PACS worklist troubleshooting',
  system: 'Merge PACS / DMWL',
  environment: 'Test',
  issue: 'Orders are visible upstream but absent from the modality worklist.',
  symptom: 'Expected worklist item is absent.',
  status: 'INVESTIGATING',
  notes: 'Use synthetic identifiers only.',
};

test('case creation normalizes bounded nonclinical fields and rejects message or secret content', () => {
  const value = createCase(caseFields, createdAt);
  assert.equal(value.schema, 'kairo.troubleshooting-case.v1');
  assert.equal(value.createdAt, createdAt);
  assert.equal(value.updatedAt, createdAt);
  assert.deepEqual(value.timeline, []);
  assert.throws(() => createCase({ ...caseFields, issue: 'PID|1||12345' }, createdAt), /CASE_NONCLINICAL_TEXT_REQUIRED/);
  assert.throws(() => createCase({ ...caseFields, notes: 'password=secret-value' }, createdAt), /CASE_NONCLINICAL_TEXT_REQUIRED/);
  assert.throws(() => createCase({ ...caseFields, status: 'CLOSED' }, createdAt), /CASE_STATUS_REJECTED/);
});

test('manual notes and allowlisted diagnostic snapshots create immutable chronological evidence', () => {
  const original = createCase(caseFields, createdAt);
  const noted = addManualNote(original, 'Receiver team confirmed the configured test port.', '2026-09-06T15:01:00.000Z');
  const attached = attachDiagnostic(noted, {
    type: 'dicom', timestamp: '2026-09-06T15:02:00.000Z', endpoint: 'PACS test · 127.0.0.1:4242', classification: 'ASSOCIATION_REJECTED',
    observed: ['TCP: TCP_CONNECTED.', 'DICOM association: ASSOCIATION_REJECTED.'],
    baselineChanges: ['DICOM association changed: ASSOCIATION_ACCEPTED → ASSOCIATION_REJECTED.'],
    likelyBoundary: 'AE configuration or the DICOM association layer is the best-supported boundary.',
    missingEvidence: 'Receiver association policy is missing.', nextCheck: 'Verify Called AE and Calling AE.',
    rawMessage: 'MSH|^~\\&|SHOULD|NOT|PERSIST', certificateBody: 'SHOULD NOT PERSIST',
  }, 'Reproduced once against the selected profile.', '2026-09-06T15:03:00.000Z');
  assert.equal(original.timeline.length, 0);
  assert.equal(noted.timeline.length, 1);
  assert.equal(attached.timeline.length, 2);
  assert.deepEqual(attached.timeline.map(item => item.evidenceType), ['MANUAL_NOTE', 'DIAGNOSTIC']);
  assert.equal(attached.timeline[1].source, 'DICOM diagnostic');
  assert.equal(attached.timeline[1].result, 'ASSOCIATION_REJECTED');
  assert.ok(!JSON.stringify(attached).includes('SHOULD'));
});

test('case summary and handoff use attached evidence and preserve uncertainty', () => {
  const withDiagnostic = attachDiagnostic(createCase(caseFields, createdAt), {
    type: 'mllp', timestamp: '2026-09-06T15:02:00.000Z', endpoint: 'Interface test · 127.0.0.1:2575', classification: 'APPLICATION_ERROR',
    observed: ['TCP: TCP_CONNECTED.', 'ACK: ACK_RECEIVED.', 'MSA-1: AE.'], baselineChanges: ['HL7 application changed: APPLICATION_ACCEPT → APPLICATION_ERROR.'],
    likelyBoundary: 'HL7 application processing, rather than transport, is the best-supported boundary.',
    missingEvidence: 'Receiver-side validation evidence is missing.', nextCheck: 'Review the correlated MSA and ERR details.',
  }, '', '2026-09-06T15:03:00.000Z');
  const summary = summarizeCase(withDiagnostic);
  assert.match(summary.observed.join(' '), /TCP_CONNECTED.*ACK_RECEIVED.*MSA-1: AE/);
  assert.match(summary.likelyBoundary, /best-supported boundary/);
  assert.match(summary.missingEvidence, /Receiver-side/);
  assert.match(summary.nextCheck, /MSA.*ERR/);
  const handoff = formatHandoff(withDiagnostic, summary);
  for (const heading of ['CASE:', 'ISSUE:', 'ENVIRONMENT:', 'OBSERVED:', 'TESTS PERFORMED:', 'BASELINE CHANGES:', 'LIKELY BOUNDARY:', 'MISSING EVIDENCE:', 'NEXT CHECK:', 'BLOCKERS:', 'STATUS:']) assert.ok(handoff.includes(heading), heading);
  assert.doesNotMatch(handoff, /hidden reasoning/i);
});
