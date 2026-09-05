import { cloneParsedMessage, parseHl7, parsePath, serializeHl7 } from './hl7-parser.mjs';

function fieldFromRaw(raw, delimiters) {
  return { raw, literal: false, repetitions: raw.split(delimiters.repetition).map((repetition) => repetition.split(delimiters.component).map((component) => component.split(delimiters.subcomponent))) };
}

function setValue(message, operation) {
  const address = parsePath(operation.path);
  if (address.segment === 'MSH' && address.field <= 2) throw new Error('EDIT_DELIMITERS_IN_RAW_VIEW');
  const segment = message.segments.find((item) => item.name === address.segment && item.occurrence === address.occurrence);
  if (!segment) throw new Error('SEGMENT_NOT_FOUND');
  const value = String(operation.value);
  const delimiters = message.delimiters;
  const forbidden = [delimiters.field, '\r', '\n'];
  if (address.component !== null) forbidden.push(delimiters.repetition, delimiters.component);
  if (address.subcomponent !== null) forbidden.push(delimiters.subcomponent);
  if (forbidden.some((character) => value.includes(character))) throw new Error('STRUCTURAL_DELIMITER_REQUIRES_ESCAPE');
  while (segment.fields.length <= address.field) segment.fields.push(fieldFromRaw('', delimiters));
  if (address.component === null && address.repetition === null) {
    segment.fields[address.field] = fieldFromRaw(value, delimiters);
    return;
  }
  const field = segment.fields[address.field];
  const repetitionIndex = (address.repetition || 1) - 1;
  while (field.repetitions.length <= repetitionIndex) field.repetitions.push([['']]);
  if (address.component === null) {
    field.repetitions[repetitionIndex] = value.split(delimiters.component).map((component) => component.split(delimiters.subcomponent));
  } else {
    const repetition = field.repetitions[repetitionIndex];
    while (repetition.length < address.component) repetition.push(['']);
    if (address.subcomponent === null) repetition[address.component - 1] = value.split(delimiters.subcomponent);
    else {
      const component = repetition[address.component - 1];
      while (component.length < address.subcomponent) component.push('');
      component[address.subcomponent - 1] = value;
    }
  }
  field.raw = field.repetitions.map((repetition) => repetition.map((component) => component.join(delimiters.subcomponent)).join(delimiters.component)).join(delimiters.repetition);
}

function applyOperation(message, operation) {
  if (operation.type === 'set-value') { setValue(message, operation); return; }
  const index = Number(operation.index);
  if (!Number.isInteger(index) || index < 0 || index > message.segments.length) throw new Error('SEGMENT_INDEX_INVALID');
  if (operation.type === 'add-segment') {
    if (!/^[A-Z0-9]{3}/.test(operation.value) || /[\r\n]/.test(operation.value)) throw new Error('ONE_SEGMENT_REQUIRED');
    const parsed = parseHl7(message.source.split(/\r\n|\r|\n/, 1)[0] + '\r' + operation.value);
    message.segments.splice(index, 0, parsed.segments[1]);
  } else {
    if (index >= message.segments.length) throw new Error('SEGMENT_INDEX_INVALID');
    if (operation.type === 'remove-segment') message.segments.splice(index, 1);
    else if (operation.type === 'clone-segment') message.segments.splice(index + 1, 0, structuredClone(message.segments[index]));
    else if (operation.type === 'move-segment') {
      if (!Number.isInteger(operation.toIndex) || operation.toIndex < 0 || operation.toIndex >= message.segments.length) throw new Error('SEGMENT_INDEX_INVALID');
      const [segment] = message.segments.splice(index, 1);
      message.segments.splice(operation.toIndex, 0, segment);
    } else throw new Error('EDIT_OPERATION_UNKNOWN');
  }
  const hadTrailingDelimiter = /[\r\n]$/.test(message.source);
  message.segments.forEach((segment, segmentIndex) => {
    segment.terminator = segmentIndex < message.segments.length - 1 || hadTrailingDelimiter ? message.segmentDelimiter : '';
  });
}

function invertOperation(message) {
  return { type: 'replace-raw', value: serializeHl7(message) };
}

export function applyEdit(message, operation) {
  const before = serializeHl7(message);
  let next;
  if (operation.type === 'replace-raw') next = parseHl7(String(operation.value));
  else {
    next = cloneParsedMessage(message);
    applyOperation(next, operation);
    next.edited = true;
    next = parseHl7(serializeHl7(next));
  }
  return { message: next, before, after: serializeHl7(next), inverse: invertOperation(message, operation) };
}

export function undoEdit(receipt) {
  return parseHl7(receipt.before);
}
