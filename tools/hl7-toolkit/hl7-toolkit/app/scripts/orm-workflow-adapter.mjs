import { getValue } from './hl7-parser.mjs';

const roleByField = Object.freeze({
  'ORC-1': ['ORDER_STATE', 'ORDER_CONTROL', 'ID'],
  'ORC-2': ['ORDER', 'PLACER', 'EI'],
  'ORC-3': ['ORDER', 'FILLER', 'EI'],
  'ORC-13': ['LOCATION', 'LOCATION', 'PL'],
  'OBR-2': ['ORDER', 'PLACER', 'EI'],
  'OBR-3': ['ORDER', 'FILLER', 'EI'],
  'OBR-4': ['PROCEDURE', 'PROCEDURE_CODE', 'CE'],
  'OBR-24': ['MODALITY', 'MODALITY', 'ID'],
  'OBR-36': ['SCHEDULE', 'SCHEDULED_AT', 'DTM'],
});

const segmentPath = segment => `${segment.name}[${segment.occurrence}]`;

function populatedPaths(segment) {
  const values = [];
  for (let fieldIndex = 1; fieldIndex < segment.fields.length; fieldIndex += 1) {
    const field = segment.fields[fieldIndex];
    field.repetitions.forEach((repetition, repetitionIndex) => repetition.forEach((component, componentIndex) => component.forEach((value, subcomponentIndex) => {
      if (!value) return;
      let path = `${segmentPath(segment)}-${fieldIndex}`;
      if (field.repetitions.length > 1) path += `[${repetitionIndex + 1}]`;
      if (repetition.length > 1 || component.length > 1) path += `.${componentIndex + 1}`;
      if (component.length > 1) path += `.${subcomponentIndex + 1}`;
      values.push({ path, value });
    })));
  }
  return values;
}

function fieldEvidence(segment, fieldNumber, concept, role, datatype) {
  const field = segment.fields[fieldNumber];
  if (!field?.raw) return null;
  const path = `${segmentPath(segment)}-${fieldNumber}`;
  return { concept, role, path, value: field.raw, datatype, components: populatedPaths({ ...segment, fields: segment.fields.map((item, index) => index === fieldNumber ? item : index ? { ...item, repetitions: [] } : item) }) };
}

export function inspectOrmMessage(message) {
  const msh9 = message?.malformed ? '' : (getValue(message, 'MSH-9') ?? '');
  const family = msh9.split(message?.delimiters?.component ?? '^')[0];
  const orderSegments = (message?.segments ?? []).filter(segment => segment.name === 'ORC' || segment.name === 'OBR');
  if (family !== 'ORM' || !orderSegments.length) return { eligibility: 'ORM_REQUIRED', msh9, groups: [], ambiguity: '', selectionState: 'ORM_REQUIRED', message };
  if (orderSegments.some(segment => !Number.isInteger(segment.occurrence) || segment.occurrence < 1)) return { eligibility: 'ELIGIBLE', msh9, groups: [], ambiguity: 'ORDER_GROUP_AMBIGUOUS', selectionState: 'ORDER_GROUP_AMBIGUOUS', message };
  const groups = [];
  let current = null;
  for (const segment of orderSegments) {
    if (segment.name === 'ORC') {
      current = { id: `order-${groups.length + 1}`, segments: [segment] };
      groups.push(current);
    } else if (current) current.segments.push(segment);
    else {
      current = { id: `order-${groups.length + 1}`, segments: [segment] };
      groups.push(current);
    }
  }
  for (const group of groups) group.segmentOccurrences = group.segments.map(segmentPath);
  return { eligibility: 'ELIGIBLE', msh9, groups, ambiguity: '', selectionState: groups.length === 1 ? 'ORM_SOURCE_READY' : 'ORDER_GROUP_SELECTION_REQUIRED', message };
}

export function projectOrmGroup(inspection, groupId) {
  if (inspection?.ambiguity) throw new Error('ORDER_GROUP_AMBIGUOUS');
  const group = inspection?.groups?.find(candidate => candidate.id === groupId);
  if (!group) throw new Error('ORDER_GROUP_SELECTION_REQUIRED');
  const values = [];
  for (const segment of group.segments) {
    for (const [key, [concept, role, datatype]] of Object.entries(roleByField)) {
      const [name, field] = key.split('-');
      if (segment.name !== name) continue;
      const evidence = fieldEvidence(segment, Number(field), concept, role, datatype);
      if (evidence) values.push(evidence);
    }
    if (segment.name === 'OBR') {
      const description = segment.fields[4]?.repetitions?.[0]?.[1]?.join(inspection.message.delimiters.subcomponent) ?? '';
      if (description) values.push({ concept: 'PROCEDURE', role: 'PROCEDURE_DESCRIPTION', path: `${segmentPath(segment)}-4.2`, value: description, datatype: 'ST', components: [{ path: `${segmentPath(segment)}-4.2`, value: description }] });
    }
  }
  for (const segment of inspection.message.segments.filter(item => item.name === 'PID')) {
    const evidence = fieldEvidence(segment, 3, 'IDENTITY', 'PATIENT_ID', 'CX');
    if (evidence) values.push(evidence);
  }
  return {
    groupId: group.id,
    msh9: inspection.msh9,
    segmentOccurrences: [...group.segmentOccurrences],
    values,
    accessionChoices: group.segments.flatMap(populatedPaths),
  };
}
