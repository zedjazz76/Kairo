import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import * as ocr from '../../hl7-toolkit/app/scripts/image-phi-assist.mjs';
import { createImageContentSession } from '../../hl7-toolkit/app/scripts/image-content.mjs';

const tesseractModule = process.env.KAIRO_TESSERACT_NODE_MODULE;

test('real Tesseract 6 recognizes positioned lines in the synthetic PNG', { skip: !tesseractModule }, async () => {
  const { createWorker } = createRequire(import.meta.url)(tesseractModule);
  const ocrRoot = resolve('hl7-toolkit/app/ocr');
  const worker = await createWorker('eng', 1, {
    corePath: resolve(ocrRoot, 'tesseract-core-lstm.wasm.js'),
    langPath: resolve(ocrRoot, 'lang'),
    cacheMethod: 'none',
    gzip: true,
  });
  try {
    const phases = [];
    const image = resolve('tests/hl7-toolkit/fixtures/images/synthetic-ocr.png');
    const result = await ocr.recognizeOcrRegions(worker, image, { onRecognitionStatus: phase => phases.push(phase) });
    assert.ok(phases.some(phase => phase.invoked === true));
    assert.ok(phases.some(phase => phase.completed === true));
    assert.equal(result.rawRegionCount, 5);
    assert.equal(result.filteredRegionCount, 5);
    assert.equal(result.words.length, result.filteredRegionCount);
    assert.ok(result.words.every(region => region.bbox.x1 > region.bbox.x0 && region.bbox.y1 > region.bbox.y0));
    assert.ok(result.words.some(region => region.words.length > 0));
    const content = createImageContentSession();
    content.load(result.words);
    assert.match(content.extracted().text, /PATIENT:/);
    const sanitized = content.sanitize();
    assert.match(sanitized.text, /NAME-0001/);
    assert.match(sanitized.text, /MRN-0001/);
    assert.match(sanitized.text, /ACCESSION-0001/);
    assert.doesNotMatch(sanitized.text, /TEST PATIENT|TEST123456|TESTACC001/);
    content.clear();
    assert.equal(content.extracted().text, '');
  } finally { await worker.terminate(); }
});
