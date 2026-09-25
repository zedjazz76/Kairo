import test from 'node:test';
import assert from 'node:assert/strict';
import { createFailureMuseum, normalizeFailureCode, sanitizeClipboardText, runClipboardSanitize } from '../../hl7-toolkit/hl7-toolkit/app/scripts/operator-kit.mjs';
import { createFieldCoach } from '../../hl7-toolkit/hl7-toolkit/app/scripts/field-coach.mjs';
import { createOcrEngineRoster, TESSERACT_ENGINE, WINDOWS_ENGINE } from '../../hl7-toolkit/hl7-toolkit/app/scripts/ocr-engines.mjs';

test('failure museum keeps only codes and a bounded list', () => {
  const museum = createFailureMuseum({ limit: 3 });
  museum.record('patient HARLAN should never appear');
  museum.record('MISSING_GEOMETRY');
  museum.record('AE');
  museum.record('IMAGE_CONTENT_LIMIT');
  const codes = museum.list().map((item) => item.code);
  assert.deepEqual(codes, ['IMAGE_CONTENT_LIMIT', 'AE', 'MISSING_GEOMETRY']);
  assert.equal(normalizeFailureCode('not a code'), 'OPERATOR_FAILURE');
});

test('clipboard sanitize writes tokens and records codes on failure', async () => {
  const museum = createFailureMuseum();
  const sanitizer = { sanitize: (text) => ({ text: 'NAME-0001', replacements: [{ category: 'name' }], warnings: [], policyVersion: '1' }) };
  const result = await runClipboardSanitize({
    readText: async () => 'Jackie Harlan',
    writeText: async (text) => { assert.equal(text, 'NAME-0001'); },
    sanitizer,
    museum,
  });
  assert.equal(result.replacementCount, 1);
  await assert.rejects(() => sanitizeClipboardText('  ', sanitizer), /CLIPBOARD_EMPTY/);
  await assert.rejects(() => runClipboardSanitize({
    readText: async () => { throw new Error('CLIPBOARD_DENIED'); },
    writeText: async () => {},
    sanitizer,
    museum,
  }), /CLIPBOARD_DENIED/);
  assert.equal(museum.list()[0].code, 'CLIPBOARD_DENIED');
});

test('field coach explains OBR-16 without dumping standard text', () => {
  const coach = createFieldCoach({
    fields: { 'OBR-16': { label: 'Ordering provider — preserved', datatype: 'XCN' } },
    segments: { get: () => ({ name: 'Observation Request', purpose: 'Study request.' }) },
  });
  const help = coach.explain('obr-16');
  assert.equal(help.found, true);
  assert.match(help.title, /OBR-16/);
  assert.equal(help.preserved, true);
});

test('Windows OCR stays unavailable until Helper advertises it', async () => {
  const roster = createOcrEngineRoster(async () => ({ engines: [{ id: WINDOWS_ENGINE, available: false, reason: 'WINDOWS_OCR_NOT_PACKAGED' }] }));
  const list = await roster.refresh();
  assert.equal(list.find((item) => item.id === TESSERACT_ENGINE).available, true);
  assert.equal(list.find((item) => item.id === WINDOWS_ENGINE).available, false);
  assert.throws(() => roster.select(WINDOWS_ENGINE), /WINDOWS_OCR_NOT_PACKAGED/);
  assert.equal(roster.select(TESSERACT_ENGINE), TESSERACT_ENGINE);
});
