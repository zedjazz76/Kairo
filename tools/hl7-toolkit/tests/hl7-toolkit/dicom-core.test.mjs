import assert from 'node:assert/strict';
import test from 'node:test';
import { explainUid, findDicomTag, parseDicomMetadata, summarizeDicom, validateDicomMetadata } from '../../hl7-toolkit/app/scripts/dicom-core.mjs';

function element(group, element, vr, value) {
  const bytes = new TextEncoder().encode(value + '\0'); const out = new Uint8Array(8 + bytes.length); const view = new DataView(out.buffer);
  view.setUint16(0, group, true); view.setUint16(2, element, true); out[4] = vr.charCodeAt(0); out[5] = vr.charCodeAt(1); view.setUint16(6, bytes.length, true); out.set(bytes, 8); return out;
}
test('reads selected explicit-VR metadata without rendering pixels', () => {
  const preamble = new Uint8Array(132); preamble.set([68, 73, 67, 77], 128);
  const parts = [preamble, element(0x0008, 0x0016, 'UI', '1.2.840.10008.5.1.4.1.1.2'), element(0x0010, 0x0020, 'LO', 'PAT-1'), element(0x0008, 0x0050, 'SH', 'ACC-1')];
  const size = parts.reduce((n, part) => n + part.length, 0); const bytes = new Uint8Array(size); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  const metadata = parseDicomMetadata(bytes.buffer);
  assert.equal(metadata.PatientID, 'PAT-1'); assert.equal(summarizeDicom(metadata).objectType, 'CT Image Storage');
});
test('finds tags and explains a transfer syntax UID', () => {
  assert.equal(findDicomTag('0010,0020').keyword, 'PatientID');
  assert.match(explainUid('1.2.840.10008.1.2.1').name, /Explicit VR Little Endian/);
});
test('finds modality worklist sequence definitions', () => {
  assert.equal(findDicomTag('0040,0100').keyword, 'ScheduledProcedureStepSequence');
  assert.equal(findDicomTag('0040,0002').keyword, 'ScheduledProcedureStepStartDate');
});
test('finds provenance-controlled Study Root query definitions', () => {
  assert.equal(findDicomTag('0008,0061').keyword, 'ModalitiesInStudy');
  assert.equal(findDicomTag('0008,0090').keyword, 'ReferringPhysicianName');
  assert.equal(findDicomTag('0020,1206').keyword, 'NumberOfStudyRelatedSeries');
  assert.equal(findDicomTag('0020,1208').keyword, 'NumberOfStudyRelatedInstances');
});
test('reports missing identifiers as possible integration concerns', () => {
  assert.deepEqual(validateDicomMetadata({ PatientID: 'P' }).map(({ code, severity }) => ({ code, severity })), [
    { code: 'DICOM_ACCESSION_MISSING', severity: 'warning' }, { code: 'DICOM_STUDY_UID_MISSING', severity: 'error' },
    { code: 'DICOM_SERIES_UID_MISSING', severity: 'error' }, { code: 'DICOM_SOP_INSTANCE_UID_MISSING', severity: 'error' },
    { code: 'DICOM_MODALITY_MISSING', severity: 'warning' },
  ]);
});
