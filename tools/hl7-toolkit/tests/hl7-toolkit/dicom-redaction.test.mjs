import assert from 'node:assert/strict';
import test from 'node:test';
import * as dicom from '../../hl7-toolkit/app/scripts/dicom-core.mjs';

test('redacted report keeps recognized technical values and excludes identifying metadata without mutation', () => {
  const metadata = Object.freeze({
    TransferSyntaxUID: '1.2.840.10008.1.2.1', SOPClassUID: '1.2.840.10008.5.1.4.1.1.2', Modality: 'CT',
    PatientName: 'PRIVATE^NAME', PatientID: 'PRIVATE-ID', PatientBirthDate: '19700101', PatientSex: 'F',
    AccessionNumber: 'PRIVATE-ACC', StudyInstanceUID: '2.25.111', SeriesInstanceUID: '2.25.112', SOPInstanceUID: '2.25.113',
    StudyDate: '20260905', StudyTime: '120000', StudyDescription: 'PRIVATE-DESCRIPTION',
    SeriesDescription: 'PRIVATE-SERIES', Manufacturer: 'PRIVATE-EQUIPMENT', StationName: 'PRIVATE-STATION',
    RequestedProcedureID: 'PRIVATE-PROCEDURE', ScheduledStationAETitle: 'PRIVATE-AE', UnknownPrivateTag: 'PRIVATE-UNKNOWN',
  });
  const original = { ...metadata };
  const report = dicom.redactDicomMetadata(metadata);
  assert.match(report, /SOP Class UID: 1\.2\.840\.10008\.5\.1\.4\.1\.1\.2 \(CT Image Storage\)/);
  assert.match(report, /Transfer Syntax UID: 1\.2\.840\.10008\.1\.2\.1 \(Explicit VR Little Endian\)/);
  assert.match(report, /Modality: CT/);
  for (const [key, value] of Object.entries(metadata)) {
    if (!['SOPClassUID', 'TransferSyntaxUID', 'Modality'].includes(key)) assert.ok(!report.includes(value), key);
  }
  assert.deepEqual(metadata, original);
});

test('unknown or misplaced technical values cannot carry arbitrary text into the copy', () => {
  const report = dicom.redactDicomMetadata({ SOPClassUID: 'PRIVATE-NAME', TransferSyntaxUID: '1.2.840.10008.5.1.4.1.1.2', Modality: 'PRIVATE-ID' });
  assert.ok(!report.includes('PRIVATE'));
  assert.ok(!report.includes('1.2.840.10008.5.1.4.1.1.2'));
  assert.match(report, /withheld/);
  assert.match(dicom.redactDicomMetadata({}), /not available/);
});
