const DEFAULT_DELIMITERS = Object.freeze({
  field: '|', component: '^', repetition: '~', escape: '\\', subcomponent: '&',
});

function detectSegmentDelimiter(source) {
  return source.match(/\r\n|\r|\n/)?.[0] || '\r';
}

function splitPreservingDelimiters(source) {
  const pieces = source.split(/(\r\n|\r|\n)/);
  const segments = [];
  for (let index = 0; index < pieces.length; index += 2) {
    if (index === pieces.length - 1 && pieces[index] === '') break;
    segments.push({ text: pieces[index], terminator: pieces[index + 1] || '' });
  }
  return segments;
}

function makeField(raw, delimiters, literal = false) {
  return {
    raw,
    literal,
    repetitions: literal
      ? [[[raw]]]
      : raw.split(delimiters.repetition).map((repetition) =>
        repetition.split(delimiters.component).map((component) => component.split(delimiters.subcomponent))),
  };
}

function buildParsedMessage(source, rawSegments, segmentDelimiter, delimiters, malformed = false) {
  const occurrences = new Map();
  const segments = rawSegments.map(({ text, terminator }, index) => {
    const parts = text.split(delimiters.field);
    const name = parts[0];
    const occurrence = (occurrences.get(name) || 0) + 1;
    occurrences.set(name, occurrence);
    const fields = [null];
    if (name === 'MSH') {
      fields.push(makeField(delimiters.field, delimiters, true));
      fields.push(makeField(parts[1] || '', delimiters, true));
      for (const value of parts.slice(2)) fields.push(makeField(value, delimiters));
    } else {
      for (const value of parts.slice(1)) fields.push(makeField(value, delimiters));
    }
    return { name, occurrence, index, raw: text, terminator, fields };
  });

  return {
    source,
    segmentDelimiter,
    delimiters,
    segments,
    malformed,
    edited: false,
    warnings: malformed ? [{ code: 'MSH_MISSING', summary: 'No usable MSH header was found.' }] : [],
  };
}

function genericMalformedMessage(source, rawSegments) {
  return buildParsedMessage(source, rawSegments, detectSegmentDelimiter(source), { ...DEFAULT_DELIMITERS }, true);
}

export function parseHl7(source) {
  if (typeof source !== 'string') throw new TypeError('HL7 source must be text');
  const rawSegments = splitPreservingDelimiters(source);
  const msh = rawSegments.find(({ text }) => text.startsWith('MSH'));
  if (!msh || msh.text.length < 8) return genericMalformedMessage(source, rawSegments);

  const delimiters = {
    field: msh.text[3],
    component: msh.text[4],
    repetition: msh.text[5],
    escape: msh.text[6],
    subcomponent: msh.text[7],
  };
  return buildParsedMessage(source, rawSegments, detectSegmentDelimiter(source), delimiters);
}

export function serializeSegment(segment, delimiters) {
  if (segment.name === 'MSH') {
    return 'MSH' + delimiters.field + segment.fields.slice(2).map(({ raw }) => raw).join(delimiters.field);
  }
  return segment.name + (segment.fields.length > 1
    ? delimiters.field + segment.fields.slice(1).map(({ raw }) => raw).join(delimiters.field)
    : '');
}

export function serializeHl7(message) {
  if (!message.edited) return message.source;
  return message.segments.map((segment) => serializeSegment(segment, message.delimiters) + segment.terminator).join('');
}

export function cloneParsedMessage(message) {
  return structuredClone(message);
}

export function parsePath(path) {
  const match = /^([A-Z0-9]{3})(?:\[(\d+)\])?-(\d+)(?:\[(\d+)\])?(?:\.(\d+))?(?:\.(\d+))?$/.exec(path);
  if (!match) throw new TypeError('Invalid HL7 field path');
  return {
    segment: match[1], occurrence: Number(match[2] || 1), field: Number(match[3]),
    repetition: match[4] ? Number(match[4]) : null,
    component: match[5] ? Number(match[5]) : null,
    subcomponent: match[6] ? Number(match[6]) : null,
  };
}

export function getValue(message, path) {
  const address = parsePath(path);
  const segment = message.segments.find((item) => item.name === address.segment && item.occurrence === address.occurrence);
  const field = segment?.fields[address.field];
  if (!field) return undefined;
  if (address.repetition === null && address.component === null) return field.raw;
  const repetition = field.repetitions[(address.repetition || 1) - 1];
  if (!repetition) return undefined;
  if (address.component === null) {
    return repetition.map((component) => component.join(message.delimiters.subcomponent)).join(message.delimiters.component);
  }
  const component = repetition[address.component - 1];
  if (!component) return undefined;
  if (address.subcomponent === null) return component.join(message.delimiters.subcomponent);
  return component[address.subcomponent - 1];
}

export function flattenPaths(message) {
  const values = new Map();
  for (const segment of message.segments) {
    const segmentPath = segment.name + (segment.occurrence > 1 ? `[${segment.occurrence}]` : '');
    for (let fieldIndex = 1; fieldIndex < segment.fields.length; fieldIndex += 1) {
      const field = segment.fields[fieldIndex];
      const fieldPath = `${segmentPath}-${fieldIndex}`;
      if (field.literal) {
        values.set(fieldPath, field.raw);
        continue;
      }
      field.repetitions.forEach((repetition, repetitionIndex) => {
        const repetitionPath = fieldPath + (field.repetitions.length > 1 ? `[${repetitionIndex + 1}]` : '');
        repetition.forEach((component, componentIndex) => {
          const componentPath = repetitionPath + (repetition.length > 1 || component.length > 1 ? `.${componentIndex + 1}` : '');
          component.forEach((value, subcomponentIndex) => {
            const leafPath = componentPath + (component.length > 1 ? `.${subcomponentIndex + 1}` : '');
            values.set(leafPath, value);
          });
        });
      });
    }
  }
  return values;
}
