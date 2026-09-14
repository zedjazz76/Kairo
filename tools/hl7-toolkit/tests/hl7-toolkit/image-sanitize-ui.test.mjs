import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as ui from '../../hl7-toolkit/app/scripts/image-sanitize-ui.mjs';

const { imageErrorCode, imageErrorMessage, safeOcrDiagnosticCode, sanitizedImageName } = ui;

test('recognition diagnostics render only phase flags and counts', () => {
  const nodes = new Map(['image-recognize-invoked', 'image-recognize-completed', 'image-raw-region-count', 'image-filtered-region-count'].map(id => [`#${id}`, { textContent: '' }]));
  const root = { querySelector: selector => nodes.get(selector) };
  ui.renderRecognitionDiagnostics(root, { invoked: true, completed: true, rawRegionCount: 5, filteredRegionCount: 5, text: 'PRIVATE OCR TEXT' });
  assert.deepEqual([...nodes.values()].map(node => node.textContent), ['YES', 'YES', '5', '5']);
  assert.doesNotMatch([...nodes.values()].map(node => node.textContent).join(' '), /PRIVATE/);
});

test('worker diagnostic codes reach the UI without exposing exception details', () => {
  for (const code of ['OCR_WORKER_BLOCKED_CSP', 'OCR_WORKER_URL_INVALID', 'OCR_WORKER_SCRIPT_EXEC_FAILED', 'OCR_WORKER_BOOTSTRAP_FAILED', 'OCR_WORKER_UNKNOWN', 'OCR_BOOTSTRAP_CREATE_FAILED', 'OCR_BOOTSTRAP_LANGUAGE_FAILED', 'OCR_BOOTSTRAP_INITIALIZE_FAILED', 'OCR_BOOTSTRAP_PROTOCOL_MISMATCH', 'OCR_BOOTSTRAP_TIMEOUT', 'OCR_RECOGNIZE_FAILED_INPUT', 'OCR_RECOGNIZE_FAILED_RUNTIME', 'OCR_RESULT_SHAPE_UNSUPPORTED', 'OCR_RESULT_EMPTY', 'OCR_FILTER_REMOVED_ALL']) {
    assert.equal(safeOcrDiagnosticCode(new Error(code)), code);
  }
  assert.equal(safeOcrDiagnosticCode(new Error('private worker exception')), 'OCR_INVOCATION_FAILED');
});

test('Quick Sanitize exposes separate text and image cards and a focused image workflow', () => {
  const html = readFileSync('hl7-toolkit/app/index.html', 'utf8');
  for (const value of ['HL7 / Text Sanitize', 'Image Sanitize', 'Open Image Sanitize →', '? Quick Guide', 'PACS screenshot', 'image-file', 'image-source-canvas', 'image-output-preview', 'image-undo', 'image-reset', 'image-clear', 'image-preview', 'image-reviewed', 'image-save']) assert.ok(html.includes(value), `Missing ${value}`);
  for (const status of ['METADATA NEEDS REVIEW', 'PIXEL CONTENT NOT REVIEWED']) assert.ok(html.includes(status));
  assert.match(html, /accept="\.png,\.jpg,\.jpeg,image\/png,image\/jpeg"/);
  for (const value of ['Detect visible text locally', 'Selected for redaction', 'Approve all likely PHI', 'Redact all detected text', 'AUTOMATED PHI REVIEW ASSISTANCE COMPLETE', 'Automated detection may miss identifying information']) assert.ok(html.includes(value), `Missing ${value}`);
  for (const label of ['OCR engine', 'Text regions detected', 'Likely PHI candidates', 'Possible PHI candidates', 'UI candidates rendered']) assert.ok(html.includes(label), `Missing diagnostic ${label}`);
  for (const id of ['image-ocr-engine', 'image-ui-candidates-rendered']) assert.match(html, new RegExp(`id="${id}"`));
  for (const id of ['image-ocr-code', 'image-worker-asset', 'image-wasm-asset', 'image-traineddata-asset']) assert.match(html, new RegExp(`id="${id}"`));
  for (const [label, id] of [['OCR recognize invoked', 'image-recognize-invoked'], ['OCR recognize completed', 'image-recognize-completed'], ['OCR raw region count', 'image-raw-region-count'], ['OCR filtered region count', 'image-filtered-region-count']]) {
    assert.ok(html.includes(label));
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('keeps the existing text sanitizer controls intact and separate', () => {
  const html = readFileSync('hl7-toolkit/app/index.html', 'utf8');
  for (const id of ['quick-input', 'sanitize-mode', 'quick-run', 'quick-output', 'copy-sanitized']) assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) ?? []).length, 1);
  assert.ok(html.indexOf('id="quick-selector"') < html.indexOf('id="quick-text-view"'));
});

test('image content extraction is primary with review-gated sanitized text and table actions', () => {
  const html = readFileSync('hl7-toolkit/app/index.html', 'utf8');
  const primary = html.indexOf('id="image-content-workflow"');
  const secondary = html.indexOf('id="image-output-workflow"');
  assert.ok(primary >= 0 && secondary > primary);
  for (const id of ['image-content-source-canvas', 'image-content-extract', 'image-content-text-view', 'image-content-table-view', 'image-content-extracted-text', 'image-content-sanitized-text', 'image-content-extracted-table', 'image-content-sanitized-table', 'image-content-review', 'image-content-sanitize', 'image-content-reviewed', 'image-content-copy-text', 'image-content-copy-table', 'image-content-export-csv']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /Image output sanitization \(optional\)/);
  assert.match(html, /Automated extraction and identifier detection may miss information/);
  const source = readFileSync('hl7-toolkit/app/scripts/image-sanitize-ui.mjs', 'utf8');
  assert.match(source, /createImageContentSession/);
  assert.match(source, /sanitizedCsv/);
});

test('creates safe new output names without reusing paths or reserved names', () => {
  assert.equal(sanitizedImageName('report.jpg', 'jpeg'), 'sanitized-image.jpg');
  assert.equal(sanitizedImageName('C:\\private\\patient.png', 'png'), 'sanitized-image.png');
  assert.equal(sanitizedImageName('CON.jpeg', 'jpeg'), 'sanitized-image.jpg');
  assert.equal(sanitizedImageName('Jane_Doe_MRN12345.png', 'png'), 'sanitized-image.png');
});

test('maps failures to non-PHI messages and explicitly rejects DICOM', () => {
  assert.match(imageErrorMessage(new Error('IMAGE_DICOM_UNSUPPORTED')), /DICOM.*not supported/i);
  assert.equal(imageErrorMessage(new Error('PATIENT-NAME')), 'Could not process this image safely. Clear it and choose a supported PNG or JPEG.');
  assert.equal(imageErrorCode(new Error('IMAGE_REDACTION_VERIFICATION_FAILED')), 'IMAGE_REDACTION_VERIFICATION_FAILED');
  assert.equal(imageErrorCode(new Error('PATIENT-NAME')), 'IMAGE_PROCESSING_FAILED');
});

test('production image workflow contains no network, storage, logging, unsafe HTML, or writable-file APIs', () => {
  const source = readFileSync('hl7-toolkit/app/scripts/image-sanitize-ui.mjs', 'utf8');
  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'localStorage', 'sessionStorage', 'indexedDB', 'console.', 'innerHTML', 'showSaveFilePicker', 'createWritable']) assert.equal(source.includes(forbidden), false, forbidden);
  assert.match(source, /textContent/);
  assert.match(source, /createBrowserOcrAdapter/);
  assert.match(source, /approveLikelyPhi/);
});
