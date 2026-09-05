import { getValue } from './hl7-parser.mjs';

const KNOWN_SEGMENTS = new Set('MSH EVN PID PD1 PV1 PV2 NK1 GT1 IN1 IN2 IN3 MRG ORC OBR OBX NTE AL1 DG1 DRG PR1 FT1 ACC UB1 UB2 SCH RGS AIS AIG AIL AIP MSA ERR SFT UAC DSC SPM SAC RXA RXR RXO RXE RXC RXD RXG TXA TQ1 TQ2 ROL QPD RCP QAK'.split(' '));
const DATE_FIELDS = new Set('MSH-7 EVN-2 EVN-3 EVN-6 PID-7 PID-29 PID-33 PV1-44 PV1-45 PV2-8 PV2-9 ORC-9 ORC-15 OBR-7 OBR-8 OBR-14 OBR-22 OBX-14 OBX-19 NK1-16 GT1-8 IN1-18 DG1-5 PR1-5 FT1-4 FT1-5 RXA-3 RXA-4 SPM-18 TXA-6 TXA-7 TXA-8 TQ1-7 TQ1-8'.split(' '));
const SET_ID_SEGMENTS = new Set('PID NK1 PV1 OBR OBX NTE AL1 DG1 PR1 FT1 GT1 IN1'.split(' '));

function finding(code, severity, path, summary, overridable = true) {
  return { id: code + ':' + path, code, severity, path, summary, source: 'Phase 1 basic checks', overridable };
}

function requireValue(findings, message, path, code) {
  if (!getValue(message, path)?.trim()) findings.push(finding(code, 'error', path, 'A required message-header value is missing.'));
}

function validateEncodingCharacters(findings, message) {
  const values = Object.values(message.delimiters);
  if (new Set(values).size !== 5 || values.some((value) => !value || /[A-Za-z0-9\s\x00-\x1f]/.test(value))) {
    findings.push(finding('ENCODING_CHARACTERS_INVALID', 'error', 'MSH-2', 'The five delimiters must be distinct, printable, non-alphanumeric characters.'));
  }
  const encoding = getValue(message, 'MSH-2');
  if (encoding !== undefined && ![4, 5].includes(encoding.length)) findings.push(finding('ENCODING_LENGTH_INVALID', 'error', 'MSH-2', 'Expected four encoding characters, or five when a truncation character is used.'));
}

function validTimestamp(value) {
  const match = /^(\d{4}(?:\d{2}){0,5})(?:\.(\d{1,4}))?([+-]\d{4})?$/.exec(value);
  if (!match || (match[2] && match[1].length !== 14)) return false;
  const digits = match[1];
  const year = Number(digits.slice(0, 4));
  const month = digits.length >= 6 ? Number(digits.slice(4, 6)) : 1;
  const day = digits.length >= 8 ? Number(digits.slice(6, 8)) : 1;
  const hour = digits.length >= 10 ? Number(digits.slice(8, 10)) : 0;
  const minute = digits.length >= 12 ? Number(digits.slice(10, 12)) : 0;
  const second = digits.length >= 14 ? Number(digits.slice(12, 14)) : 0;
  if (year < 1000 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return false;
  if (match[3] && (Number(match[3].slice(1, 3)) > 23 || Number(match[3].slice(3, 5)) > 59)) return false;
  return true;
}

function validateRecognizedTimestamps(findings, message) {
  for (const segment of message.segments) {
    segment.fields.forEach((field, index) => {
      const base = segment.name + '-' + index;
      const path = segment.name + (segment.occurrence > 1 ? '[' + segment.occurrence + ']' : '') + '-' + index;
      if (!field || !DATE_FIELDS.has(base)) return;
      for (const repetition of field.repetitions) {
        const value = repetition[0]?.[0];
        if (value && !validTimestamp(value)) findings.push(finding('TIMESTAMP_SYNTAX', 'warning', path, 'This recognized timestamp does not have valid basic HL7 date/time syntax or calendar values.'));
      }
    });
  }
}

function validateRecognizedNumbers(findings, message) {
  for (const segment of message.segments) {
    const prefix = segment.name + (segment.occurrence > 1 ? '[' + segment.occurrence + ']' : '');
    const setId = segment.fields[1]?.raw;
    if (SET_ID_SEGMENTS.has(segment.name) && setId && !/^\d+$/.test(setId)) findings.push(finding('SET_ID_SYNTAX', 'warning', prefix + '-1', 'The set identifier is not a nonnegative integer.'));
    if (segment.name === 'OBX' && segment.fields[2]?.raw === 'NM') {
      for (const repetition of segment.fields[5]?.repetitions || []) {
        const value = repetition[0]?.[0];
        if (value && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) findings.push(finding('NUMBER_SYNTAX', 'warning', prefix + '-5', 'The NM observation value is not a basic decimal number.'));
      }
    }
  }
}

function reportUnknownSegments(findings, message) {
  for (const segment of message.segments) {
    const path = segment.name + (segment.occurrence > 1 ? '[' + segment.occurrence + ']' : '');
    if (!/^[A-Z][A-Z0-9]{2}$/.test(segment.name)) findings.push(finding('SEGMENT_IDENTIFIER_INVALID', 'error', path || 'message', 'A segment identifier is malformed.'));
    else if (!KNOWN_SEGMENTS.has(segment.name)) findings.push(finding('UNKNOWN_SEGMENT', 'not-evaluated', path, 'No Phase 1 structural definition is available for this segment.'));
  }
}

function reportDuplicateControlId(findings, message, controlIds) {
  const value = getValue(message, 'MSH-10');
  if (value && (controlIds.get(value) || 0) > 1) findings.push(finding('DUPLICATE_CONTROL_ID', 'warning', 'MSH-10', 'This control ID occurs more than once in the loaded catalog.'));
}

export function validateBasic(message, { controlIds = new Map(), framingWarnings = [] } = {}) {
  const findings = [];
  const headers = message.segments.filter((segment) => segment.name === 'MSH');
  if (headers.length !== 1 || message.segments[0]?.name !== 'MSH' || /[\u000b\u001c]/.test(message.source)) {
    findings.push(finding('ONE_MESSAGE_REQUIRED', 'error', 'message', 'Send requires exactly one unframed message beginning with MSH. Select or repair the boundary first.', false));
  }
  if (message.malformed) findings.push(finding('MSH_MALFORMED', 'error', 'MSH', 'A usable MSH header was not found.'));
  requireValue(findings, message, 'MSH-9', 'MSH_9_REQUIRED');
  requireValue(findings, message, 'MSH-10', 'MSH_10_REQUIRED');
  requireValue(findings, message, 'MSH-12', 'MSH_12_REQUIRED');
  validateEncodingCharacters(findings, message);
  validateRecognizedTimestamps(findings, message);
  validateRecognizedNumbers(findings, message);
  reportUnknownSegments(findings, message);
  reportDuplicateControlId(findings, message, controlIds);
  for (const segment of message.segments) {
    segment.fields.forEach((field, index) => {
      if (field && !field.literal && field.raw.split(message.delimiters.escape).length % 2 === 0) {
        findings.push(finding('UNBALANCED_ESCAPE', 'warning', segment.name + '-' + index, 'An escape delimiter has no matching closing delimiter.'));
      }
    });
  }
  if (new Set(headers.map((header) => header.fields[12]?.raw)).size > 1) findings.push(finding('INCONSISTENT_VERSION', 'error', 'MSH-12', 'Multiple headers declare different versions.'));
  for (const warning of framingWarnings) findings.push(finding(warning.code || 'BOUNDARY_WARNING', 'warning', 'message', warning.summary || 'Review the imported message boundary.'));
  findings.push(finding('DEEP_VALIDATION_NOT_EVALUATED', 'not-evaluated', 'message', 'Version-specific structures, tables, cardinality, clinical semantics, and local conformance profiles are not evaluated in Phase 1.'));
  return [...new Map(findings.map((item) => [item.id, item])).values()];
}

function countFindingsBySeverity(findings) {
  const counts = { error: 0, warning: 0, information: 0, 'not-evaluated': 0 };
  for (const item of findings) counts[item.severity] += 1;
  return counts;
}

export function summarizeSendPreflight(findings, acknowledgedIds = []) {
  const acknowledged = new Set(acknowledgedIds);
  const blocking = findings.filter((item) => ['error', 'warning'].includes(item.severity) && (!item.overridable || !acknowledged.has(item.id)));
  return { ready: blocking.length === 0, blockingIds: blocking.map((item) => item.id), counts: countFindingsBySeverity(findings) };
}

export async function hashMessage(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
