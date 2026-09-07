import { findDicomTag } from './dicom-core.mjs';

export function todayLocal(now = new Date()) {
  const part = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${part(now.getMonth() + 1)}-${part(now.getDate())}`;
}

const text = (value) => String(value ?? '').trim();
const ae = /^[\x20-\x7e]{1,16}$/;
const date = /^\d{4}-\d{2}-\d{2}$/;

export function buildMwlRequest(values) {
  const host = text(values.host);
  const port = Number(values.port);
  const timeoutMs = Number(values.timeoutMs ?? 3000);
  const callingAe = text(values.callingAe);
  const calledAe = text(values.calledAe);
  if (!host || host.length > 255) throw new Error('MWL_HOST_INVALID');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MWL_PORT_INVALID');
  if (!ae.test(callingAe) || callingAe.includes('\\')) throw new Error('MWL_CALLING_AE_INVALID');
  if (!ae.test(calledAe) || calledAe.includes('\\')) throw new Error('MWL_CALLED_AE_INVALID');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 10000) throw new Error('MWL_TIMEOUT_INVALID');
  const source = values.criteria ?? {};
  const criteria = {};
  if (text(source.scheduledDate)) {
    if (!date.test(text(source.scheduledDate))) throw new Error('MWL_DATE_INVALID');
    criteria.scheduledDate = text(source.scheduledDate).replaceAll('-', '');
  }
  for (const key of ['modality', 'scheduledStationAe', 'patientId', 'accessionNumber', 'requestedProcedureId', 'requestedProcedureDescription', 'scheduledLocation']) {
    if (text(source[key])) criteria[key] = text(source[key]);
  }
  const code = source.procedureCode ?? {};
  if (text(code.value) || text(code.scheme)) {
    if (!text(code.value) || !text(code.scheme)) throw new Error('MWL_PROCEDURE_CODE_PAIR_REQUIRED');
    criteria.procedureCode = { value: text(code.value), scheme: text(code.scheme) };
  }
  if (!Object.keys(criteria).length) throw new Error('MWL_CRITERION_REQUIRED');
  return { schema: 'kairo.mwl-query.v1', host, port, callingAe, calledAe, timeoutMs, criteria };
}

export function normalizeMwlResult(result) {
  if (!result || !Array.isArray(result.items)) throw new Error('MWL_RESPONSE_INVALID');
  if (result.items.length > 100) throw new Error('MWL_RESPONSE_LIMIT_VIOLATION');
  return structuredClone(result);
}

export function mwlInspectorRows(item) {
  return (item?.tags ?? []).map((entry) => {
    const definition = findDicomTag(entry.tag);
    const names = (entry.path ?? []).map((part) => findDicomTag(part)?.name ?? part);
    if (definition) names.push(definition.name);
    return { path: names.join(' → '), tag: `(${entry.tag.slice(0, 4)},${entry.tag.slice(4)})`, keyword: definition?.keyword ?? 'Unknown', value: entry.value, definition: definition?.definition ?? definition?.name ?? 'Unknown DICOM attribute' };
  });
}

export function emptyMwlState() { return { result: null, items: [], selectedIndex: -1 }; }
