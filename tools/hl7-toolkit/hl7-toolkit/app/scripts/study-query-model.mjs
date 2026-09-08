import { findDicomTag } from './dicom-core.mjs';

const TOP_LEVEL = new Set(['schema', 'host', 'port', 'callingAe', 'calledAe', 'timeoutMs', 'criteria']);
const CRITERIA = new Set(['accessionNumber', 'patientId', 'studyInstanceUid', 'studyDate', 'studyDateRange', 'modalitiesInStudy']);
const LIMITS = { accessionNumber: 16, patientId: 64, studyInstanceUid: 64, modalitiesInStudy: 16 };
const aePattern = /^[\x20-\x7e]{1,16}$/;
const uidPattern = /^[0-9]+(?:\.[0-9]+)+$/;

function exactText(value, code, maximum) {
  if (typeof value !== 'string' || !value || value !== value.trim() || value.length > maximum) throw new Error(code);
  if (value.includes('*') || value.includes('?')) throw new Error('STUDY_WILDCARD_NOT_SUPPORTED');
  return value;
}

function dicomDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('STUDY_DATE_INVALID');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('STUDY_DATE_INVALID');
  return value.replaceAll('-', '');
}

export function buildStudyQueryRequest(values) {
  if (!values || Array.isArray(values) || typeof values !== 'object') throw new Error('STUDY_INPUT_REJECTED');
  for (const key of Object.keys(values)) if (!TOP_LEVEL.has(key)) throw new Error('STUDY_INPUT_REJECTED');
  if (values.schema !== undefined && values.schema !== 'kairo.study-query.v1') throw new Error('STUDY_SCHEMA_REJECTED');
  const host = exactText(values.host, 'STUDY_HOST_INVALID', 253);
  if (/[/*?]/.test(host)) throw new Error('STUDY_HOST_INVALID');
  const port = Number(values.port), timeoutMs = Number(values.timeoutMs);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('STUDY_PORT_INVALID');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 10000) throw new Error('STUDY_TIMEOUT_INVALID');
  const callingAe = exactText(values.callingAe, 'STUDY_CALLING_AE_INVALID', 16);
  const calledAe = exactText(values.calledAe, 'STUDY_CALLED_AE_INVALID', 16);
  if (!aePattern.test(callingAe) || callingAe.includes('\\')) throw new Error('STUDY_CALLING_AE_INVALID');
  if (!aePattern.test(calledAe) || calledAe.includes('\\')) throw new Error('STUDY_CALLED_AE_INVALID');
  const source = values.criteria;
  if (!source || Array.isArray(source) || typeof source !== 'object') throw new Error('STUDY_CRITERION_REQUIRED');
  for (const key of Object.keys(source)) if (!CRITERIA.has(key)) throw new Error('STUDY_INPUT_REJECTED');
  const criteria = {};
  for (const key of Object.keys(LIMITS)) if (source[key] !== undefined && source[key] !== '') criteria[key] = exactText(source[key], key === 'studyInstanceUid' ? 'STUDY_UID_INVALID' : 'STUDY_CRITERION_INVALID', LIMITS[key]);
  if (criteria.studyInstanceUid && !uidPattern.test(criteria.studyInstanceUid)) throw new Error('STUDY_UID_INVALID');
  if (source.studyDate !== undefined && source.studyDate !== '') criteria.studyDate = dicomDate(source.studyDate);
  if (source.studyDateRange !== undefined) {
    const range = source.studyDateRange;
    if (!range || Array.isArray(range) || typeof range !== 'object' || Object.keys(range).some(key => !['start', 'end'].includes(key)) || !range.start || !range.end) throw new Error('STUDY_DATE_RANGE_INVALID');
    let start, end;
    try { start = dicomDate(range.start); end = dicomDate(range.end); } catch { throw new Error('STUDY_DATE_RANGE_INVALID'); }
    if (start > end || criteria.studyDate) throw new Error('STUDY_DATE_RANGE_INVALID');
    criteria.studyDateRange = { start, end };
  }
  if (!Object.keys(criteria).length) throw new Error('STUDY_CRITERION_REQUIRED');
  return { schema: 'kairo.study-query.v1', host, port, callingAe, calledAe, timeoutMs, criteria };
}

export function normalizeStudyQueryResult(result) {
  if (!result || Array.isArray(result) || !Array.isArray(result.items)) throw new Error('STUDY_RESPONSE_INVALID');
  if (result.items.length > 100) throw new Error('STUDY_RESPONSE_LIMIT_VIOLATION');
  return structuredClone(result);
}

export function studyInspectorRows(item) {
  return (item?.tags ?? []).map(entry => {
    const definition = findDicomTag(entry.tag);
    const names = (entry.path ?? []).map(part => findDicomTag(part)?.name ?? part);
    if (definition) names.push(definition.name);
    const normalized = String(entry.tag).replace(/[^a-f0-9]/gi, '').toUpperCase();
    return { path: names.join(' → '), tag: `(${normalized.slice(0, 4)},${normalized.slice(4)})`, keyword: definition?.keyword ?? 'Unknown', value: entry.value, definition: definition?.definition ?? definition?.name ?? 'Unknown DICOM attribute' };
  });
}

export function emptyStudyQueryState() { return { result: null, request: null, items: [], selectedIndex: -1 }; }
