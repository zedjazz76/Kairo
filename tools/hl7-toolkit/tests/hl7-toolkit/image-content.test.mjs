import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createImageContentSession, extractImageContent, sanitizedCsv } from '../../hl7-toolkit/app/scripts/image-content.mjs';

const line = (text, y, cells = null) => ({ text, bbox: { x0: 10, y0: y, x1: 600, y1: y + 25 }, words: cells?.map(([text, x0, x1]) => ({ text, bbox: { x0, y0: y, x1, y1: y + 25 } })) });

test('synthetic labeled screenshot preserves reading order and sanitizes identifiers consistently', () => {
  const session = createImageContentSession();
  session.load([
    line('PATIENT: TEST PATIENT', 10), line('MRN: TEST123456', 40), line('ACCESSION: TESTACC001', 70),
    line('PATIENT: TEST PATIENT', 100), line('MODALITY: CT', 130), line('PROCEDURE: CHEST W CONTRAST', 160),
  ]);
  assert.match(session.extracted().text, /^PATIENT: TEST PATIENT\nMRN: TEST123456\nACCESSION: TESTACC001/);
  const result = session.sanitize();
  assert.match(result.text, /^PATIENT: NAME-0001\nMRN: MRN-0001\nACCESSION: ACCESSION-0001\nPATIENT: NAME-0001/m);
  assert.match(result.text, /MODALITY: CT\nPROCEDURE: CHEST W CONTRAST/);
  assert.doesNotMatch(result.text, /TEST PATIENT|TEST123456|TESTACC001/);
  assert.equal(session.extracted().table.status, 'UNCERTAIN');
  session.clear();
  assert.equal(session.extracted().text, '');
  assert.equal(session.sanitized(), null);
  assert.equal(session.review().length, 0);
});

test('OCR field labels without punctuation still sanitize their values', () => {
  const session = createImageContentSession();
  session.load([line('PATIENT TEST PATIENT', 10), line('MRN TEST123456', 40), line('ACCESSION TESTACC001', 70), line('DOB 19800101', 100)]);
  const { text } = session.sanitize();
  assert.match(text, /PATIENT NAME-0001/);
  assert.match(text, /MRN MRN-0001/);
  assert.match(text, /ACCESSION ACCESSION-0001/);
  assert.match(text, /DOB REL-DAY\+0/);
  assert.doesNotMatch(text, /TEST PATIENT|TEST123456|TESTACC001|19800101/);
});

test('text mode recognizes explicit patient, record and accession aliases without punctuation', () => {
  const session = createImageContentSession();
  session.load([
    line('PATIENT: JOHN SMITH', 10), line('PATIENT NAME JOHN SMITH', 40), line('NAME JOHN SMITH', 70),
    line('mRn: 00123456', 100), line('medical record number 00123456', 130),
    line('Patient ID ABC-123456', 160), line('PATIENTID ABC-123456', 190),
    line('ACCESSION: AB12345', 220), line('Acc AB12345', 250), line('accession number XY-0002', 280),
    line('DOB: 01/01/1980', 310), line('MODALITY: MR', 340), line('PROCEDURE CT CHEST', 370),
  ]);
  const result = session.sanitize();
  assert.match(result.text, /^PATIENT: NAME-0001\nPATIENT NAME NAME-0001\nNAME NAME-0001/m);
  assert.match(result.text, /mRn: MRN-0001\nmedical record number MRN-0001/);
  assert.match(result.text, /Patient ID MRN-0002\nPATIENTID MRN-0002/);
  assert.match(result.text, /ACCESSION: ACCESSION-0001\nAcc ACCESSION-0001\naccession number ACCESSION-0002/);
  assert.match(result.text, /DOB: REL-DAY\+0/);
  assert.match(result.text, /MODALITY: MR\nPROCEDURE CT CHEST/);
  assert.doesNotMatch(result.text, /JOHN SMITH|00123456|ABC-123456|AB12345|XY-0002|01\/01\/1980/);
  assert.equal(session.review().filter(item => item.category === 'name').length, 1);
  assert.equal(session.review().filter(item => item.category === 'mrn').length, 2);
  assert.equal(session.review().filter(item => item.category === 'accession').length, 2);
});

test('label spelling tolerates bounded spacing and punctuation variants without guessing unlabeled clinical text', () => {
  const session = createImageContentSession();
  session.load([
    line('Patient-Name: Jane Doe', 10), line('PATIENT_ID: 0000999', 40),
    line('medical   record   number 0000888', 70), line('Acc. ZX-00001', 100),
    line('MODALITY: CT', 130), line('PROCEDURE: MRI BRAIN', 160),
  ]);
  const result = session.sanitize();
  assert.match(result.text, /Patient-Name: NAME-0001/);
  assert.match(result.text, /PATIENT_ID: MRN-0001\nmedical   record   number MRN-0002/);
  assert.match(result.text, /Acc\. ACCESSION-0001/);
  assert.match(result.text, /MODALITY: CT\nPROCEDURE: MRI BRAIN/);
  assert.doesNotMatch(result.text, /Jane Doe|0000999|0000888|ZX-00001/);
});

test('text mode pairs only adjacent OCR label and value lines while preserving source line order', () => {
  const session = createImageContentSession();
  session.load([
    line('PATIENT NAME', 10), line('SMITH, JOHN', 40),
    line('MRN', 70), line('000123-4', 100),
    line('ACCESSION:', 130), line('AB-00123', 160),
    line('PATIENT NAME', 190), line('SMITH, JOHN', 220),
    line('MODALITY MR', 250), line('PROCEDURE CT CHEST', 280),
  ]);
  assert.equal(session.extracted().text.split('\n')[0], 'PATIENT NAME');
  const result = session.sanitize();
  assert.equal(result.text, 'PATIENT NAME\nNAME-0001\nMRN\nMRN-0001\nACCESSION:\nACCESSION-0001\nPATIENT NAME\nNAME-0001\nMODALITY MR\nPROCEDURE CT CHEST');
  assert.doesNotMatch(result.text, /SMITH, JOHN|000123-4|AB-00123/);
});

test('spatially adjacent same-row OCR regions pair identifiers but unrelated regions do not', () => {
  const session = createImageContentSession();
  session.load([
    { text: 'MRN', bbox: { x0: 10, y0: 10, x1: 60, y1: 30 } },
    { text: '00001234', bbox: { x0: 90, y0: 11, x1: 190, y1: 31 } },
    { text: 'ACCESSION', bbox: { x0: 10, y0: 60, x1: 100, y1: 80 } },
    { text: 'AB-12345', bbox: { x0: 130, y0: 61, x1: 230, y1: 81 } },
    { text: 'PATIENT NAME', bbox: { x0: 10, y0: 110, x1: 160, y1: 130 } },
    { text: 'PROCEDURE: CT CHEST', bbox: { x0: 10, y0: 210, x1: 250, y1: 230 } },
  ]);
  const result = session.sanitize();
  assert.match(result.text, /^MRN\nMRN-0001\nACCESSION\nACCESSION-0001/m);
  assert.match(result.text, /PATIENT NAME\nPROCEDURE: CT CHEST$/);
  assert.doesNotMatch(result.text, /00001234|AB-12345/);
});

test('standalone patient label does not consume adjacent clinical field lines as a name', () => {
  const session = createImageContentSession();
  session.load([
    line('PATIENT NAME', 10), line('MODALITY MR', 40),
    line('PATIENT NAME', 70), line('PROCEDURE CT CHEST', 100),
    line('PATIENT NAME', 130), line('JOHN SMITH', 160),
  ]);
  assert.equal(session.sanitize().text, 'PATIENT NAME\nMODALITY MR\nPATIENT NAME\nPROCEDURE CT CHEST\nPATIENT NAME\nNAME-0001');
});

test('token-split OCR lines and distinct name formats use label context, not arbitrary clinical phrases', () => {
  const session = createImageContentSession();
  session.load([
    line('MRN 12345678', 10, [['MRN', 10, 70], ['12345678', 90, 220]]),
    line('NAME DOE^JANE', 40, [['NAME', 10, 85], ['DOE^JANE', 100, 250]]),
    line('NAME JANE-MARY-DOE', 70), line('PHYSICIAN: TEST DOCTOR', 100),
    line('FACILITY: TEST IMAGING CENTER', 130), line('PHONE 555-010-2233', 160),
    line('EMAIL test.patient@example.com', 190), line('ADDRESS 123 SYNTHETIC ST', 220),
    line('RESULT: No acute abnormality', 250),
  ]);
  const result = session.sanitize();
  assert.match(result.text, /MRN MRN-0001\nNAME NAME-0001\nNAME NAME-0002/);
  assert.match(result.text, /PHYSICIAN: NAME-0003\nFACILITY: FACILITY-0001/);
  assert.match(result.text, /PHONE PHONE-0001\nEMAIL EMAIL-0001\nADDRESS ADDRESS-0001/);
  assert.match(result.text, /RESULT: No acute abnormality/);
  assert.doesNotMatch(result.text, /12345678|DOE\^JANE|JANE-MARY-DOE|TEST DOCTOR|TEST IMAGING CENTER|555-010-2233|test\.patient@example\.com|123 SYNTHETIC/);
});

test('table mode classifies PATIENTID and ACC headers independently and exports only sanitized cells', () => {
  const session = createImageContentSession();
  session.load([
    line('PATIENT PATIENTID ACC MODALITY', 10, [['PATIENT', 10, 110], ['PATIENTID', 180, 300], ['ACC', 370, 430], ['MODALITY', 500, 620]]),
    line('JOHN SMITH 001234 AB12345 MR', 45, [['JOHN', 10, 65], ['SMITH', 70, 135], ['001234', 180, 260], ['AB12345', 370, 460], ['MR', 500, 530]]),
    line('JANE DOE 002345 CD67890 CT', 80, [['JANE', 10, 65], ['DOE', 70, 125], ['002345', 180, 260], ['CD67890', 370, 460], ['CT', 500, 530]]),
    line('JOHN SMITH 001234 AB12345 MR', 115, [['JOHN', 10, 65], ['SMITH', 70, 135], ['001234', 180, 260], ['AB12345', 370, 460], ['MR', 500, 530]]),
  ]);
  assert.equal(session.extracted().table.status, 'READY');
  const result = session.sanitize();
  assert.deepEqual(result.table.rows[1], ['NAME-0001', 'MRN-0001', 'ACCESSION-0001', 'MR']);
  assert.deepEqual(result.table.rows[2], ['NAME-0002', 'MRN-0002', 'ACCESSION-0002', 'CT']);
  assert.deepEqual(result.table.rows[3], ['NAME-0001', 'MRN-0001', 'ACCESSION-0001', 'MR']);
  for (const output of [result.text, sanitizedCsv(result.table)]) assert.doesNotMatch(output, /JOHN SMITH|JANE DOE|001234|002345|AB12345|CD67890/);
  session.clear();
  assert.equal(session.review().length, 0);
  assert.equal(session.sanitized(), null);
});

test('synthetic multi-patient grid yields bounded cells and sanitized CSV only', () => {
  const session = createImageContentSession();
  session.load([
    line('PATIENT MRN MODALITY', 10, [['PATIENT', 10, 100], ['MRN', 220, 270], ['MODALITY', 390, 510]]),
    line('TEST PATIENT A12345 CT', 45, [['TEST', 10, 60], ['PATIENT', 65, 150], ['A12345', 220, 300], ['CT', 390, 420]]),
    line('SECOND PATIENT B98765 MR', 80, [['SECOND', 10, 90], ['PATIENT', 95, 180], ['B98765', 220, 300], ['MR', 390, 420]]),
  ]);
  const extracted = session.extracted();
  assert.equal(extracted.table.status, 'READY');
  assert.equal(extracted.table.rows.length, 3);
  assert.deepEqual(extracted.table.rows[1], ['TEST PATIENT', 'A12345', 'CT']);
  const result = session.sanitize();
  assert.deepEqual(result.table.rows[1], ['NAME-0001', 'MRN-0001', 'CT']);
  assert.deepEqual(result.table.rows[2], ['NAME-0002', 'MRN-0002', 'MR']);
  const csv = sanitizedCsv(result.table);
  assert.match(csv, /NAME-0001,MRN-0001,CT/);
  assert.doesNotMatch(csv, /TEST PATIENT|SECOND PATIENT|A12345|B98765/);
  assert.doesNotMatch(result.text, /TEST PATIENT|SECOND PATIENT|A12345|B98765/);
});

test('CSV cannot retain a known name from an earlier unclassified table cell', () => {
  const session = createImageContentSession();
  session.load([
    line('NOTES PATIENT MRN', 10, [['NOTES', 10, 80], ['PATIENT', 220, 310], ['MRN', 420, 470]]),
    line('TEST PATIENT TEST PATIENT A12345', 45, [['TEST', 10, 50], ['PATIENT', 55, 130], ['TEST', 220, 260], ['PATIENT', 265, 340], ['A12345', 420, 500]]),
    line('OTHER PATIENT OTHER PATIENT B98765', 80, [['OTHER', 10, 75], ['PATIENT', 80, 150], ['OTHER', 220, 285], ['PATIENT', 290, 360], ['B98765', 420, 500]]),
  ]);
  assert.equal(session.extracted().table.status, 'READY');
  const csv = sanitizedCsv(session.sanitize().table);
  assert.doesNotMatch(csv, /TEST PATIENT|OTHER PATIENT|A12345|B98765/);
});

test('dates preserve relative intervals, contacts and account identifiers are replaced', () => {
  const session = createImageContentSession();
  session.load([
    line('DOB: 1980-01-01', 10), line('VISIT DATE: 1980-01-03', 40),
    line('PHONE: 555-010-2233', 70), line('EMAIL: test.patient@example.com', 100),
    line('ACCOUNT: ACCT778899', 130), line('ORDER: ORD123456', 160),
  ]);
  const { text } = session.sanitize();
  assert.match(text, /DOB: REL-DAY\+0/);
  assert.match(text, /VISIT DATE: REL-DAY\+2/);
  assert.match(text, /PHONE: PHONE-0001/);
  assert.match(text, /EMAIL: EMAIL-0001/);
  assert.match(text, /ACCOUNT: ACCOUNT-0001/);
  assert.match(text, /ORDER: ORDER-0001/);
  assert.doesNotMatch(text, /1980|555-010|example\.com|ACCT778899|ORD123456/);
});

test('uncertain columns fall back to text and do not fabricate cells', () => {
  const result = extractImageContent([
    line('PATIENT MRN', 10, [['PATIENT', 10, 100], ['MRN', 220, 270]]),
    line('TEST PATIENT 12345', 45, [['TEST', 10, 60], ['PATIENT', 65, 150], ['12345', 220, 300]]),
    line('No aligned columns on this line', 80),
  ]);
  assert.equal(result.table.status, 'UNCERTAIN');
  assert.deepEqual(result.table.rows, []);
  assert.match(result.text, /No aligned columns on this line/);
});

test('table mode refuses unlabeled or incomplete OCR word grids', () => {
  const unlabeled = [
    line('ALPHA BETA', 10, [['ALPHA', 10, 80], ['BETA', 220, 280]]),
    line('VALUE ONE', 45, [['VALUE', 10, 80], ['ONE', 220, 270]]),
    line('VALUE TWO', 80, [['VALUE', 10, 80], ['TWO', 220, 270]]),
  ];
  assert.equal(extractImageContent(unlabeled).table.status, 'UNCERTAIN');
  const incomplete = [
    line('PATIENT MRN', 10, [['PATIENT', 10, 100], ['MRN', 220, 270]]),
    line('TEST PATIENT A12345', 45, [['TEST', 10, 60], ['PATIENT', 65, 150], ['A12345', 220, 300]]),
    line('SECOND PATIENT B98765', 80, [['SECOND', 10, 90], ['B98765', 220, 300]]),
  ];
  assert.equal(extractImageContent(incomplete).table.status, 'UNCERTAIN');
});

test('unlabeled contact patterns and repeated known identifiers are sanitized without changing clinical terms', () => {
  const session = createImageContentSession();
  session.load([
    line('PATIENT: TEST PATIENT', 10), line('CT CHEST result sent to test.patient@example.com', 40),
    line('Call 312-555-0199 about TEST PATIENT', 70), line('PHYSICIAN: TEST DOCTOR', 100),
    line('FACILITY: TEST IMAGING CENTER', 130), line('ADDRESS: 123 SYNTHETIC ST', 160),
  ]);
  const { text } = session.sanitize();
  assert.match(text, /CT CHEST result sent to EMAIL-0001/);
  assert.match(text, /Call PHONE-0001 about NAME-0001/);
  assert.match(text, /PHYSICIAN: NAME-0002/);
  assert.match(text, /FACILITY: FACILITY-0001/);
  assert.match(text, /ADDRESS: ADDRESS-0001/);
  assert.doesNotMatch(text, /TEST PATIENT|test\.patient@example\.com|312-555-0199|TEST DOCTOR|TEST IMAGING CENTER|123 SYNTHETIC/);
});

test('CSV escapes cells and blocks spreadsheet formulas', () => {
  assert.equal(sanitizedCsv({ status: 'READY', rows: [['A,B', '=SUM(1,2)', 'line\nbreak']] }), '"A,B","\'=SUM(1,2)","line\nbreak"');
  assert.equal(sanitizedCsv({ status: 'UNCERTAIN', rows: [] }), '');
});

test('content extraction has no network, persistence, or raw-content logging path', () => {
  const source = readFileSync('hl7-toolkit/app/scripts/image-content.mjs', 'utf8');
  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'localStorage', 'sessionStorage', 'indexedDB', 'console.', 'innerHTML']) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test('oversize OCR cannot silently truncate a value or produce partial sanitized output', () => {
  assert.throws(() => extractImageContent([line('A'.repeat(1001), 10)]), { message: 'IMAGE_CONTENT_LIMIT' });
  const session = createImageContentSession();
  assert.throws(() => session.load(Array.from({ length: 501 }, (_, index) => line('MRN: TEST123456', index * 30))), { message: 'IMAGE_CONTENT_LIMIT' });
  assert.equal(session.extracted().text, '');
  assert.equal(session.sanitized(), null);
});
