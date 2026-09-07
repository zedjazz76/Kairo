const trim = value => String(value ?? '').trim();

const sourceFor = Object.freeze({
  PATIENT_ID: 'Patient ID (0010,0020)',
  ACCESSION: 'Accession Number (0008,0050)',
  PROCEDURE_CODE: 'Requested Procedure Code Sequence (0032,1064)',
  PROCEDURE_DESCRIPTION: 'Requested Procedure Description (0032,1060)',
  MODALITY: 'Scheduled Procedure Step Sequence → Modality (0008,0060)',
  LOCATION: 'Scheduled Procedure Step Sequence → Scheduled Procedure Step Location (0040,0011)',
  SCHEDULED_AT: 'Scheduled Procedure Step Sequence → Start Date (0040,0002) / Start Time (0040,0003)',
  STATION_AE: 'Scheduled Procedure Step Sequence → Scheduled Station AE Title (0040,0001)',
});

function mwlValue(role, mwl) {
  const item = mwl.item;
  const criteria = mwl.query?.criteria ?? {};
  const step = item?.scheduledProcedureStep ?? {};
  if (role === 'PATIENT_ID') return item ? item.patientId : criteria.patientId;
  if (role === 'ACCESSION') return item ? item.accessionNumber : criteria.accessionNumber;
  if (role === 'PROCEDURE_CODE') return item ? item.requestedProcedureCode : criteria.procedureCode;
  if (role === 'PROCEDURE_DESCRIPTION') return item ? item.requestedProcedureDescription : criteria.requestedProcedureDescription;
  if (role === 'MODALITY') return item ? step.modality : criteria.modality;
  if (role === 'LOCATION') return item ? step.scheduledLocation : criteria.scheduledLocation;
  if (role === 'STATION_AE') return item ? step.scheduledStationAe : criteria.scheduledStationAe;
  if (role === 'SCHEDULED_AT') return item ? `${step.scheduledDate ?? ''}${step.scheduledTime ?? ''}` : (criteria.scheduledDate ?? '');
  return undefined;
}

function codeParts(value) {
  if (value && typeof value === 'object') return { value: trim(value.value), system: trim(value.scheme ?? value.system), description: trim(value.description) };
  const parts = String(value ?? '').split('^');
  return { value: trim(parts[0]), description: trim(parts[1]), system: trim(parts[2]) };
}

function datePrecision(value) {
  const clean = trim(value).replace(/[.+-].*$/, '');
  if (!/^\d{8}(?:\d{2}(?:\d{2}(?:\d{2}(?:\.\d+)?)?)?)?$/.test(clean)) return null;
  return { clean, precision: clean.length === 8 ? 'date' : clean.length === 10 ? 'hour' : clean.length === 12 ? 'minute' : clean.length === 14 ? 'second' : 'fraction' };
}

function compareValues(role, hl7, mwl) {
  const left = trim(hl7), right = trim(mwl);
  const trimmed = left !== String(hl7 ?? '') || right !== String(mwl ?? '');
  const explanation = trimmed ? 'Compared after trimming surrounding whitespace.' : 'Compared using original semantic components.';
  if (!left && !right) return { state: 'NOT_COMPARABLE', precision: '', explanation: 'Neither established source contains a value.' };
  if (!left) return { state: 'MISSING_IN_HL7', precision: '', explanation: 'The established HL7 counterpart is absent.' };
  if (!right) return { state: 'MISSING_IN_MWL', precision: '', explanation: 'The selected MWL item lacks the established counterpart.' };
  if (role === 'PATIENT_ID') {
    const parts = left.split('^');
    if (parts.slice(1).some(Boolean)) return { state: parts[0] === right ? 'AMBIGUOUS' : 'MISMATCH', precision: '', explanation: 'Composite identifier components, including authority or type, remain significant.' };
  }
  if (role === 'PROCEDURE_CODE') {
    const a = codeParts(hl7), b = codeParts(mwl);
    if (!a.value || !b.value || !a.system || !b.system) return { state: 'NOT_COMPARABLE', precision: '', explanation: 'Code value and coding system are both required.' };
    return { state: a.value === b.value && a.system === b.system ? 'MATCH' : 'MISMATCH', precision: '', explanation: 'Compared code value and coding system; descriptions are separate evidence.' };
  }
  if (role === 'SCHEDULED_AT') {
    const a = datePrecision(left), b = datePrecision(right);
    if (!a || !b) return { state: 'AMBIGUOUS', precision: '', explanation: 'The date/time representation has multiple or unsupported interpretations.' };
    if (a.precision !== b.precision) {
      const shorter = a.clean.length < b.clean.length ? a : b;
      const longer = shorter === a ? b : a;
      if (shorter.clean.length > 8 && /^0*$/.test(longer.clean.slice(shorter.clean.length))) return { state: shorter.clean === longer.clean.slice(0, shorter.clean.length) ? 'MATCH' : 'MISMATCH', precision: shorter.precision, explanation: 'Compared at the explicit lower precision; omitted lower-order time digits were zero.' };
      return { state: 'NOT_COMPARABLE', precision: `${a.precision}/${b.precision}`, explanation: 'Date/time precision is not compatible and no timezone or missing precision was invented.' };
    }
    return { state: a.clean === b.clean ? 'MATCH' : 'MISMATCH', precision: a.precision, explanation };
  }
  return { state: left === right ? 'MATCH' : 'MISMATCH', precision: '', explanation };
}

function makeRow(id, value, role, target, targetSource, established = true) {
  const comparison = established ? compareValues(role, value.value, target) : { state: 'NOT_COMPARABLE', precision: '', explanation: 'The concept registry does not establish these identifier roles as semantic counterparts.' };
  return { id, concept: value.concept, role, valueKind: value.datatype, hl7Source: value.path, hl7Value: value.value, mwlSource: targetSource ?? '', mwlValue: target && typeof target === 'object' ? JSON.stringify(target) : (target ?? ''), ...comparison };
}

function aggregate(rows) {
  return [...new Set(rows.map(row => row.concept))].map(concept => {
    const members = rows.filter(row => row.concept === concept);
    const conflicts = [...new Set(members.map(row => `${row.role}:${trim(row.hl7Value)}`))].length > new Set(members.map(row => row.role)).size;
    const states = new Set(members.map(row => row.state));
    let state = 'PARTIALLY_AVAILABLE';
    if (conflicts || states.has('AMBIGUOUS') || states.has('MISMATCH') && states.has('MATCH')) state = 'AMBIGUOUS';
    else if (members.length > 1 && new Set(members.map(row => trim(row.hl7Value))).size === 1 || states.size === 1 && states.has('MATCH')) state = 'CONSISTENT';
    else if ([...states].every(value => value === 'NOT_COMPARABLE')) state = 'NOT_COMPARABLE';
    else if (states.has('MISMATCH')) state = 'AMBIGUOUS';
    return { concept, rowIds: members.map(row => row.id), state, explanation: state === 'AMBIGUOUS' ? 'The selected evidence contains conflicting or mixed results.' : state === 'CONSISTENT' ? 'The populated comparable evidence is consistent.' : state === 'NOT_COMPARABLE' ? 'No registry-established semantic comparison is available.' : 'Only part of the relevant evidence is comparable.' };
  });
}

export function buildWorkflowGuidance({ mode, rows, concepts, orm, mwl }) {
  const nextChecks = [];
  let likelyBoundary = 'The selected evidence does not yet isolate a troubleshooting boundary.';
  const observed = [];
  let missingEvidence = 'Receiver-side workflow and mapping evidence is still needed.';
  if (mode === 'ZERO_MATCH_QUERY_CONTEXT') {
    observed.push('The selected ORM contains upstream order evidence.', 'The MWL query completed successfully and zero items matched the displayed criteria.');
    likelyBoundary = 'Order ingestion, MWL generation, filtering, or mapping is the best-supported boundary.';
    missingEvidence = 'Receiver ingestion state and the configured worklist mapping and filters are missing.';
    nextChecks.push('Verify the exact visible MWL criteria against the intended order.', 'Review receiver-side ingestion and worklist mapping for the selected order.');
  } else {
    observed.push('One eligible ORM order group and one explicitly selected worklist item were compared.');
    const stateValue = orm?.values?.find(value => value.role === 'ORDER_CONTROL')?.value;
    if (/^(CA|DC|HD)$/i.test(trim(stateValue))) {
      likelyBoundary = 'Order lifecycle or cancellation propagation is the best-supported boundary.';
      missingEvidence = 'Receiver acceptance, transition timing, and worklist removal behavior are missing.';
      nextChecks.push('Verify the receiver-side order status and worklist lifecycle timestamps.');
    } else if (rows.some(row => row.concept === 'PROCEDURE' && row.state === 'MISMATCH')) {
      likelyBoundary = 'Procedure-code mapping or selected-item correspondence is the best-supported boundary.';
      nextChecks.push('Verify the configured procedure-code and coding-system mapping.');
    } else if (rows.some(row => row.concept === 'MODALITY' && row.state === 'MISMATCH')) {
      likelyBoundary = 'Procedure-to-modality mapping or selected-item correspondence is the best-supported boundary.';
      nextChecks.push('Verify the modality mapping for the selected procedure.');
    } else if (concepts.some(concept => concept.state === 'AMBIGUOUS')) {
      likelyBoundary = 'Interface source-of-truth mapping is the best-supported boundary.';
      missingEvidence = 'The authoritative sender and receiver field mapping is missing.';
      nextChecks.push('Confirm the authoritative field for the conflicting concept.');
    } else nextChecks.push('Confirm that the selected worklist item is the intended comparison target.');
  }
  return { observed, likelyBoundary, missingEvidence, nextChecks: nextChecks.slice(0, 3) };
}

export function compareOrmToMwl({ orm, mwl, accessionSourcePath = '' }) {
  const rows = [];
  let index = 0;
  for (const value of orm.values ?? []) {
    if (value.role === 'PLACER' || value.role === 'FILLER' || value.role === 'ORDER_CONTROL') rows.push(makeRow(`row-${++index}`, value, value.role, '', '', false));
    else if (sourceFor[value.role]) {
      const target = mwlValue(value.role, mwl);
      const established = mwl.mode !== 'ZERO_MATCH_QUERY_CONTEXT' || Boolean(trim(target));
      rows.push(makeRow(`row-${++index}`, value, value.role, target, sourceFor[value.role], established));
    }
  }
  if (mwl.mode === 'SELECTED_ITEM_COMPARISON') {
    const missingCandidates = [
      ['IDENTITY', 'PATIENT_ID', 'PID-3', 'CX'], ['PROCEDURE', 'PROCEDURE_CODE', 'OBR-4', 'CE'],
      ['MODALITY', 'MODALITY', 'OBR-24', 'ID'], ['LOCATION', 'LOCATION', 'ORC-13', 'PL'],
      ['SCHEDULE', 'SCHEDULED_AT', 'OBR-36', 'DTM'], ['STATION_AE', 'STATION_AE', 'Configured HL7 station-AE source', 'ID'],
    ];
    for (const [concept, role, path, datatype] of missingCandidates) {
      const target = mwlValue(role, mwl);
      if (trim(target) && !(orm.values ?? []).some(value => value.role === role)) rows.push(makeRow(`row-${++index}`, { concept, role, path, value: '', datatype }, role, target, sourceFor[role], true));
    }
  }
  const accession = (orm.accessionChoices ?? []).find(choice => choice.path === accessionSourcePath);
  rows.push(makeRow(`row-${++index}`, { concept: 'ACCESSION', path: accession?.path ?? '', value: accession?.value ?? '', datatype: 'ST' }, 'ACCESSION', mwlValue('ACCESSION', mwl), sourceFor.ACCESSION, Boolean(accession)));
  const concepts = aggregate(rows);
  const guidance = buildWorkflowGuidance({ mode: mwl.mode, rows, concepts, orm, mwl });
  return { mode: mwl.mode, rows, concepts, guidance, warnings: [] };
}

export function clearWorkflowComparisonState() {
  return { ormSource: null, groupId: '', accessionSourcePath: '', mwlTarget: null, comparison: null };
}
