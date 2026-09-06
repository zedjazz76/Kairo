const STATUS = new Set(['OPEN', 'INVESTIGATING', 'BLOCKED', 'RESOLVED']);
const LIMITS = { title: 120, system: 120, environment: 40, issue: 1200, symptom: 600, notes: 2000, evidenceNote: 600 };
const UNSAFE = /[\x00-\x08\x0b\x0c\x0e-\x1f]|(?:^|\r|\n)(?:MSH|PID|PV1|OBX|ORC|OBR)[|^]|BEGIN (?:RSA |EC |OPENSSH )?(?:PRIVATE )?KEY|BEGIN CERTIFICATE|(?:password|token|secret)\s*[:=]/i;

function safeText(value, name, required = false) {
  if (typeof value !== 'string') throw new Error('CASE_TEXT_REJECTED');
  const clean = value.trim();
  if ((required && !clean) || clean.length > LIMITS[name]) throw new Error('CASE_TEXT_REJECTED');
  if (UNSAFE.test(clean)) throw new Error('CASE_NONCLINICAL_TEXT_REQUIRED');
  return clean;
}

function iso(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('CASE_TIMESTAMP_REJECTED');
  return new Date(value).toISOString();
}

function updated(caseData, item) {
  return { ...caseData, updatedAt: item.timestamp, timeline: [...caseData.timeline, item].sort((a, b) => a.timestamp.localeCompare(b.timestamp)) };
}

export function createCase(fields, now = new Date().toISOString()) {
  if (!fields || Array.isArray(fields)) throw new Error('CASE_OBJECT_REQUIRED');
  if (!STATUS.has(fields.status)) throw new Error('CASE_STATUS_REJECTED');
  const timestamp = iso(now);
  return {
    schema: 'kairo.troubleshooting-case.v1',
    id: `case-${timestamp.replace(/\D/g, '')}`,
    title: safeText(fields.title, 'title', true),
    system: safeText(fields.system, 'system', true),
    environment: safeText(fields.environment, 'environment', true),
    issue: safeText(fields.issue, 'issue', true),
    symptom: safeText(fields.symptom, 'symptom', true),
    status: fields.status,
    notes: safeText(fields.notes || '', 'notes'),
    createdAt: timestamp,
    updatedAt: timestamp,
    timeline: [],
  };
}

export function addManualNote(caseData, note, now = new Date().toISOString()) {
  const timestamp = iso(now);
  const clean = safeText(note, 'evidenceNote', true);
  return updated(caseData, { schema: 'kairo.case-evidence.v1', id: `note-${timestamp.replace(/\D/g, '')}`, timestamp, evidenceType: 'MANUAL_NOTE', source: 'Analyst note', endpoint: '', result: clean, observed: [], analystNote: clean, baselineChanges: [] });
}

export function attachDiagnostic(caseData, snapshot, note = '', now = new Date().toISOString()) {
  if (!snapshot || Array.isArray(snapshot)) throw new Error('CASE_EVIDENCE_REJECTED');
  const timestamp = iso(now);
  const type = typeof snapshot.type === 'string' ? snapshot.type.toLowerCase() : '';
  if (!['tcp', 'dicom', 'http', 'https', 'mllp'].includes(type)) throw new Error('CASE_EVIDENCE_REJECTED');
  const strings = values => Array.isArray(values) ? values.filter(value => typeof value === 'string').slice(0, 20).map(value => safeText(value, 'evidenceNote')) : [];
  const labels = { tcp: 'TCP diagnostic', dicom: 'DICOM diagnostic', http: 'HTTP diagnostic', https: 'HTTPS diagnostic', mllp: 'HL7 / MLLP diagnostic' };
  return updated(caseData, {
    schema: 'kairo.case-evidence.v1', id: `diagnostic-${timestamp.replace(/\D/g, '')}`, timestamp,
    evidenceType: 'DIAGNOSTIC', source: labels[type], endpoint: safeText(snapshot.endpoint || '', 'system'),
    result: safeText(snapshot.classification || 'UNKNOWN', 'environment', true), observed: strings(snapshot.observed),
    analystNote: safeText(note, 'evidenceNote'), baselineChanges: strings(snapshot.baselineChanges),
    likelyBoundary: safeText(snapshot.likelyBoundary || '', 'issue'), missingEvidence: safeText(snapshot.missingEvidence || '', 'issue'),
    nextCheck: safeText(snapshot.nextCheck || '', 'issue'), diagnosticTimestamp: iso(snapshot.timestamp || now),
  });
}

export function summarizeCase(caseData) {
  const diagnostic = [...caseData.timeline].reverse().find(item => item.evidenceType === 'DIAGNOSTIC');
  if (!diagnostic) return { observed: ['No diagnostic evidence is attached to this case.'], likelyBoundary: 'The available case evidence does not yet isolate a troubleshooting boundary.', missingEvidence: 'A protocol-specific diagnostic result is still needed.', nextCheck: 'Run the smallest relevant existing Kairo diagnostic, then attach its result explicitly.' };
  return {
    observed: diagnostic.observed.length ? diagnostic.observed : [`${diagnostic.source}: ${diagnostic.result}.`],
    likelyBoundary: diagnostic.likelyBoundary || 'The attached evidence does not yet isolate a troubleshooting boundary.',
    missingEvidence: diagnostic.missingEvidence || 'Additional workflow-specific evidence is still needed.',
    nextCheck: diagnostic.nextCheck || 'Review the attached evidence and choose the smallest protocol-specific next check.',
  };
}

export function formatHandoff(caseData, summary = summarizeCase(caseData)) {
  const diagnostics = caseData.timeline.filter(item => item.evidenceType === 'DIAGNOSTIC');
  const bullets = values => values.length ? values.map(value => `- ${value}`).join('\n') : '- None recorded.';
  return [
    `CASE:\n- ${caseData.title}`, `ISSUE:\n- ${caseData.issue}\n- Symptom: ${caseData.symptom}`,
    `ENVIRONMENT:\n- ${caseData.environment}\n- System/workflow: ${caseData.system}`, `OBSERVED:\n${bullets(summary.observed)}`,
    `TESTS PERFORMED:\n${bullets(diagnostics.map(item => `${item.source}: ${item.result}${item.endpoint ? ` at ${item.endpoint}` : ''}.`))}`,
    `BASELINE CHANGES:\n${bullets(diagnostics.flatMap(item => item.baselineChanges))}`,
    `LIKELY BOUNDARY:\n- ${summary.likelyBoundary}`, `MISSING EVIDENCE:\n- ${summary.missingEvidence}`,
    `NEXT CHECK:\n- ${summary.nextCheck}`, `BLOCKERS:\n${caseData.status === 'BLOCKED' ? `- ${caseData.notes || 'Case is marked blocked; blocker detail is not recorded.'}` : '- None recorded.'}`,
    `STATUS:\n- ${caseData.status}`,
  ].join('\n\n');
}
