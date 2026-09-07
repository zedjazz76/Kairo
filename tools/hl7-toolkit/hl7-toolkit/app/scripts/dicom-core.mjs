const TAGS = {
  '00020010': { name: 'Transfer Syntax UID', keyword: 'TransferSyntaxUID', vr: 'UI', vm: '1', category: 'File Meta' },
  '00080016': { name: 'SOP Class UID', keyword: 'SOPClassUID', vr: 'UI', vm: '1', category: 'Instance' },
  '00080018': { name: 'SOP Instance UID', keyword: 'SOPInstanceUID', vr: 'UI', vm: '1', category: 'Instance' },
  '00080050': { name: 'Accession Number', keyword: 'AccessionNumber', vr: 'SH', vm: '1', category: 'Study' },
  '00100010': { name: 'Patient Name', keyword: 'PatientName', vr: 'PN', vm: '1', category: 'Patient' },
  '00100020': { name: 'Patient ID', keyword: 'PatientID', vr: 'LO', vm: '1', category: 'Patient' },
  '0020000D': { name: 'Study Instance UID', keyword: 'StudyInstanceUID', vr: 'UI', vm: '1', category: 'Study' },
  '0020000E': { name: 'Series Instance UID', keyword: 'SeriesInstanceUID', vr: 'UI', vm: '1', category: 'Series' },
  '00080060': { name: 'Modality', keyword: 'Modality', vr: 'CS', vm: '1', category: 'Series' },
  '00100030': { name: 'Patient Birth Date', keyword: 'PatientBirthDate', vr: 'DA', vm: '1', category: 'Patient' },
  '00100040': { name: 'Patient Sex', keyword: 'PatientSex', vr: 'CS', vm: '1', category: 'Patient' },
  '00080020': { name: 'Study Date', keyword: 'StudyDate', vr: 'DA', vm: '1', category: 'Study' },
  '00080030': { name: 'Study Time', keyword: 'StudyTime', vr: 'TM', vm: '1', category: 'Study' },
  '00081030': { name: 'Study Description', keyword: 'StudyDescription', vr: 'LO', vm: '1', category: 'Study' },
  '0008103E': { name: 'Series Description', keyword: 'SeriesDescription', vr: 'LO', vm: '1', category: 'Series' },
  '00200011': { name: 'Series Number', keyword: 'SeriesNumber', vr: 'IS', vm: '1', category: 'Series' },
  '00200013': { name: 'Instance Number', keyword: 'InstanceNumber', vr: 'IS', vm: '1', category: 'Instance' },
  '00080070': { name: 'Manufacturer', keyword: 'Manufacturer', vr: 'LO', vm: '1', category: 'Equipment' },
  '00081090': { name: 'Manufacturer Model Name', keyword: 'ManufacturerModelName', vr: 'LO', vm: '1', category: 'Equipment' },
  '00081010': { name: 'Station Name', keyword: 'StationName', vr: 'SH', vm: '1', category: 'Equipment' },
  '00181020': { name: 'Software Versions', keyword: 'SoftwareVersions', vr: 'LO', vm: '1-n', category: 'Equipment' },
  '00401001': { name: 'Requested Procedure ID', keyword: 'RequestedProcedureID', vr: 'SH', vm: '1', category: 'Workflow' },
  '00400009': { name: 'Scheduled Procedure Step ID', keyword: 'ScheduledProcedureStepID', vr: 'SH', vm: '1', category: 'Workflow' },
  '00400001': { name: 'Scheduled Station AE Title', keyword: 'ScheduledStationAETitle', vr: 'AE', vm: '1-n', category: 'Workflow' },
  '00080005': { name: 'Specific Character Set', keyword: 'SpecificCharacterSet', vr: 'CS', vm: '1-n', category: 'Workflow', definition: 'Character repertoire used to encode text values.' },
  '00081060': { name: 'Name of Physician(s) Reading Study', keyword: 'NameOfPhysiciansReadingStudy', vr: 'PN', vm: '1-n', category: 'Workflow', definition: 'Physician associated with reading the requested study.' },
  '00321060': { name: 'Requested Procedure Description', keyword: 'RequestedProcedureDescription', vr: 'LO', vm: '1', category: 'Workflow', definition: 'Description of the requested procedure.' },
  '00400100': { name: 'Scheduled Procedure Step Sequence', keyword: 'ScheduledProcedureStepSequence', vr: 'SQ', vm: '1', category: 'Workflow', definition: 'Sequence containing scheduled procedure step details.' },
  '00400002': { name: 'Scheduled Procedure Step Start Date', keyword: 'ScheduledProcedureStepStartDate', vr: 'DA', vm: '1', category: 'Workflow', definition: 'Date on which the scheduled procedure step starts.' },
  '00400003': { name: 'Scheduled Procedure Step Start Time', keyword: 'ScheduledProcedureStepStartTime', vr: 'TM', vm: '1', category: 'Workflow', definition: 'Time at which the scheduled procedure step starts.' },
  '00400006': { name: 'Scheduled Performing Physician Name', keyword: 'ScheduledPerformingPhysicianName', vr: 'PN', vm: '1', category: 'Workflow', definition: 'Physician scheduled to perform the procedure step.' },
  '00400007': { name: 'Scheduled Procedure Step Description', keyword: 'ScheduledProcedureStepDescription', vr: 'LO', vm: '1', category: 'Workflow', definition: 'Description of the scheduled procedure step.' },
  '00400010': { name: 'Scheduled Station Name', keyword: 'ScheduledStationName', vr: 'SH', vm: '1-n', category: 'Workflow', definition: 'Name of the scheduled station.' },
  '00081110': { name: 'Referenced Study Sequence', keyword: 'ReferencedStudySequence', vr: 'SQ', vm: '1', category: 'Workflow', definition: 'References a related study.' },
};
const UIDS = {
  '1.2.840.10008.5.1.4.1.1.2': { name: 'CT Image Storage', category: 'Storage' },
  '1.2.840.10008.1.2.1': { name: 'Explicit VR Little Endian', category: 'Transfer Syntax' },
  '1.2.840.10008.1.2': { name: 'Implicit VR Little Endian', category: 'Transfer Syntax' },
  '1.2.840.10008.5.1.4.1.1.4': { name: 'MR Image Storage', category: 'Storage' },
};
export function findDicomTag(query) {
  const normalized = String(query).replace(/[^a-f0-9]/gi, '').toUpperCase();
  return TAGS[normalized] || Object.values(TAGS).find((tag) => [tag.keyword, tag.name].some((value) => value.toLowerCase() === String(query).toLowerCase())) || null;
}
export function explainUid(uid) { return UIDS[uid] || { name: 'Unknown DICOM UID', category: 'Unknown' }; }
export function parseDicomMetadata(buffer) {
  const bytes = new Uint8Array(buffer); const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = bytes[128] === 68 && bytes[129] === 73 && bytes[130] === 67 && bytes[131] === 77 ? 132 : 0; const metadata = {};
  while (offset + 8 <= bytes.length) {
    const tag = view.getUint16(offset, true).toString(16).padStart(4, '0') + view.getUint16(offset + 2, true).toString(16).padStart(4, '0');
    const vr = String.fromCharCode(bytes[offset + 4], bytes[offset + 5]);
    const headerLength = ['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'SQ', 'UC', 'UR', 'UT', 'UN', 'SV', 'UV'].includes(vr) ? 12 : 8;
    if (offset + headerLength > bytes.length) break;
    const length = headerLength === 12 ? view.getUint32(offset + 8, true) : view.getUint16(offset + 6, true);
    if (offset + headerLength + length > bytes.length) break;
    const definition = TAGS[tag.toUpperCase()];
    if (definition) metadata[definition.keyword] = new TextDecoder().decode(bytes.slice(offset + headerLength, offset + headerLength + length)).replace(/\0+$/g, '').trim();
    offset += headerLength + length;
  }
  return metadata;
}
export function summarizeDicom(metadata) {
  return { objectType: explainUid(metadata.SOPClassUID).name, patientId: metadata.PatientID || '', accession: metadata.AccessionNumber || '' };
}
export function redactDicomMetadata(metadata) {
  // Only recognized technical constants may leave the inspection view. Do not
  // copy arbitrary values, including unknown UIDs, equipment text or filenames.
  const uid = (value, category) => !value ? 'not available'
    : Object.hasOwn(UIDS, value) && UIDS[value].category === category
      ? value + ' (' + UIDS[value].name + ')' : 'withheld (unrecognized value)';
  const modality = !metadata.Modality ? 'not available'
    : ['CT', 'MR', 'CR', 'DX', 'US', 'NM', 'PT', 'MG', 'XA', 'RF', 'SC', 'SR', 'PR', 'OT'].includes(metadata.Modality)
      ? metadata.Modality : 'withheld (unrecognized value)';
  return [
    'DICOM redacted troubleshooting summary',
    'SOP Class UID: ' + uid(metadata.SOPClassUID, 'Storage'),
    'Transfer Syntax UID: ' + uid(metadata.TransferSyntaxUID, 'Transfer Syntax'),
    'Modality: ' + modality,
    'All other metadata and the filename are omitted.',
    'Limited metadata summary; not a de-identified DICOM object or proof of compatibility.',
  ].join('\n');
}
export function validateDicomMetadata(metadata) {
  const checks = [['AccessionNumber', 'DICOM_ACCESSION_MISSING', 'warning'], ['StudyInstanceUID', 'DICOM_STUDY_UID_MISSING', 'error'], ['SeriesInstanceUID', 'DICOM_SERIES_UID_MISSING', 'error'], ['SOPInstanceUID', 'DICOM_SOP_INSTANCE_UID_MISSING', 'error'], ['Modality', 'DICOM_MODALITY_MISSING', 'warning']];
  return checks.filter(([field]) => !metadata[field]).map(([, code, severity]) => ({ id: code, code, severity, summary: 'Possible integration concern: required metadata is not available. Verify the source object and destination logs.', source: 'Stage 4 DICOM metadata', overridable: true }));
}
