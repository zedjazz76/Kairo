import { getValue, parseHl7, parsePath } from './hl7-parser.mjs';

const METADATA_FIELDS = new Set(['index', 'type', 'family', 'controlId', 'version', 'timestamp', 'sendingApplication', 'receivingApplication', 'framing', 'length']);
const TEXT_OPERATORS = new Set(['exists', 'missing', 'empty', 'equals', 'contains', 'regex']);
const NUMBER_OPERATORS = new Set(['exists', 'missing', 'equals', 'greater-than', 'less-than']);

function filterError(code, conditionId) {
  const error = new TypeError('Filter condition ' + (conditionId || 'unknown') + ' is invalid.');
  error.code = code;
  return error;
}

function normalizeCondition(condition, index) {
  const id = String(condition?.id || 'condition-' + (index + 1));
  const target = condition?.target;
  const field = String(condition?.field || '').trim();
  const operator = condition?.operator;
  const value = String(condition?.value ?? '');
  if (!['metadata', 'path'].includes(target)) throw filterError('FILTER_TARGET_INVALID', id);
  if (target === 'metadata' && !METADATA_FIELDS.has(field)) throw filterError('FILTER_FIELD_INVALID', id);
  if (target === 'path') {
    try { parsePath(field); } catch { throw filterError('FILTER_PATH_INVALID', id); }
  }
  const operators = target === 'metadata' && ['length', 'index'].includes(field) ? NUMBER_OPERATORS : TEXT_OPERATORS;
  if (!operators.has(operator)) throw filterError('FILTER_OPERATOR_INVALID', id);
  if (value.length > 256) throw filterError('FILTER_VALUE_TOO_LONG', id);
  if (['greater-than', 'less-than'].includes(operator) && !Number.isFinite(Number(value))) throw filterError('FILTER_NUMBER_INVALID', id);
  if (operator === 'regex') {
    try { new RegExp(value, 'i'); } catch { throw filterError('FILTER_REGEX_INVALID', id); }
  }
  return { id, target, field, operator, value };
}

export function validateFilter(filter) {
  if (!filter || !Array.isArray(filter.conditions)) throw filterError('FILTER_INVALID');
  return { conditions: filter.conditions.map(normalizeCondition) };
}

export function isDeepFilter(filter) {
  return filter.conditions.some(({ target }) => target === 'path');
}

export function createFilterResultGate() {
  let revision = 0;
  return {
    begin() { revision += 1; return revision; },
    invalidate() { revision += 1; },
    accept(candidate) { return candidate === revision; },
  };
}

function pathValues(message, path) {
  const address = parsePath(path);
  const parsed = parseHl7(message.text);
  const segment = parsed.segments.find((item) => item.name === address.segment && item.occurrence === address.occurrence);
  const field = segment?.fields[address.field];
  if (!field) return [];
  if (address.repetition !== null || address.component === null) {
    const value = getValue(parsed, path);
    return value === undefined ? [] : [value];
  }
  return field.repetitions.map((repetition) => {
    const component = repetition[address.component - 1];
    if (!component) return undefined;
    return address.subcomponent === null ? component.join(parsed.delimiters.subcomponent) : component[address.subcomponent - 1];
  }).filter((value) => value !== undefined);
}

function matches(values, { operator, value }) {
  if (operator === 'exists') return values.length > 0;
  if (operator === 'missing') return values.length === 0;
  if (operator === 'empty') return values.some((item) => String(item) === '');
  const wanted = value.toLowerCase();
  if (operator === 'equals') return values.some((item) => String(item).toLowerCase() === wanted);
  if (operator === 'contains') return values.some((item) => String(item).toLowerCase().includes(wanted));
  if (operator === 'regex') {
    const pattern = new RegExp(value, 'i');
    return values.some((item) => pattern.test(String(item)));
  }
  const number = Number(values[0]);
  if (operator === 'greater-than') return number > Number(value);
  if (operator === 'less-than') return number < Number(value);
  return false;
}

function matchesAll(message, conditions) {
  let parsedPathValues;
  return conditions.every((condition) => {
    const values = condition.target === 'metadata'
      ? (message[condition.field] === undefined || message[condition.field] === null ? [] : [message[condition.field]])
      : (parsedPathValues ??= new Map(), parsedPathValues.has(condition.field)
        ? parsedPathValues.get(condition.field)
        : (parsedPathValues.set(condition.field, pathValues(message, condition.field)), parsedPathValues.get(condition.field)));
    return matches(values, condition);
  });
}

export async function filterMessages(messages, filter, {
  signal, onProgress = () => {}, chunkSize = 250,
} = {}) {
  const normalized = validateFilter(filter);
  const ids = [];
  const size = Math.max(1, Number(chunkSize) || 250);
  for (let offset = 0; offset < messages.length; offset += size) {
    if (signal?.aborted) throw new DOMException('Filter canceled', 'AbortError');
    for (const message of messages.slice(offset, offset + size)) {
      if (matchesAll(message, normalized.conditions)) ids.push(message.id);
    }
    onProgress({ processed: Math.min(offset + size, messages.length), total: messages.length, matched: ids.length });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (signal?.aborted) throw new DOMException('Filter canceled', 'AbortError');
  return { ids, matched: ids.length, total: messages.length };
}
