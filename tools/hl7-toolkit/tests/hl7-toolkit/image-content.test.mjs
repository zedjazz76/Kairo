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
  assert.match(text, /PATIENT: NAME-0001/);
  assert.match(text, /MRN: MRN-0001/);
  assert.match(text, /ACCESSION: ACCESSION-0001/);
  assert.match(text, /DOB: REL-DAY\+0/);
  assert.doesNotMatch(text, /TEST PATIENT|TEST123456|TESTACC001|19800101/);
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
