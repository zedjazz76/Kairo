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
export function validateDicomMetadata(metadata) {
  const checks = [['AccessionNumber', 'DICOM_ACCESSION_MISSING', 'warning'], ['StudyInstanceUID', 'DICOM_STUDY_UID_MISSING', 'error'], ['SeriesInstanceUID', 'DICOM_SERIES_UID_MISSING', 'error'], ['SOPInstanceUID', 'DICOM_SOP_INSTANCE_UID_MISSING', 'error'], ['Modality', 'DICOM_MODALITY_MISSING', 'warning']];
  return checks.filter(([field]) => !metadata[field]).map(([, code, severity]) => ({ id: code, code, severity, summary: 'Possible integration concern: required metadata is not available. Verify the source object and destination logs.', source: 'Stage 4 DICOM metadata', overridable: true }));
}
