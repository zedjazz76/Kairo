import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import * as ocr from '../../hl7-toolkit/app/scripts/image-phi-assist.mjs';

const { classifyOcrText, createLocalOcrAdapter, createPhiAssistModel, normalizeOcrWords } = ocr;

test('normalizes OCR words into bounded source-pixel candidates with confidence', () => {
  const result = normalizeOcrWords([{ text: 'MRN: 123456', confidence: 96, bbox: { x0: 10, y0: 20, x1: 90, y1: 34 } }], { width: 100, height: 60 });
  assert.deepEqual(result, [{ id: 'ocr-1', text: 'MRN: 123456', confidence: 0.96, rectangle: { x: 10, y: 20, width: 80, height: 14 }, classification: 'LIKELY_PHI' }]);
});

test('classifies context labels and identifier shapes conservatively', () => {
  assert.equal(classifyOcrText('PATIENT: ROBERT SMITH'), 'LIKELY_PHI');
  assert.equal(classifyOcrText('DOB: 01/02/1980'), 'LIKELY_PHI');
  assert.equal(classifyOcrText('ACCESSION ABC12345'), 'LIKELY_PHI');
  assert.equal(classifyOcrText('Phone: 312-555-0199'), 'POSSIBLE_PHI');
  assert.equal(classifyOcrText('Window Level 40'), 'NOT_CLASSIFIED');
});

test('selection model exposes counts and rectangles without raw OCR text', () => {
  const model = createPhiAssistModel({ width: 200, height: 100 });
  model.setFindings([
    { text: 'PATIENT: ROBERT SMITH', confidence: 0.98, bbox: { x0: 2, y0: 3, x1: 80, y1: 15 } },
    { text: 'Window Level 40', confidence: 0.99, bbox: { x0: 2, y0: 20, x1: 70, y1: 30 } },
  ]);
  assert.deepEqual(model.snapshot(), { detectedTextRegions: 2, likelyPhi: 1, possiblePhi: 0, selectedForRedaction: 0, findings: [{ id: 'ocr-1', classification: 'LIKELY_PHI', confidence: 0.98, rectangle: { x: 2, y: 3, width: 78, height: 12 }, selected: false }, { id: 'ocr-2', classification: 'NOT_CLASSIFIED', confidence: 0.99, rectangle: { x: 2, y: 20, width: 68, height: 10 }, selected: false }] });
  model.approveLikelyPhi();
  assert.equal(model.snapshot().selectedForRedaction, 1);
  model.toggle('ocr-2');
  assert.equal(model.snapshot().selectedForRedaction, 2);
  assert.doesNotMatch(JSON.stringify(model.snapshot()), /ROBERT|Window|PATIENT/);
  assert.deepEqual(model.selectedRectangles(), [{ x: 2, y: 3, width: 78, height: 12 }, { x: 2, y: 20, width: 68, height: 10 }]);
});

test('local OCR adapter returns injected recognition results without network fallback', async () => {
  const image = { localOnly: true };
  const adapter = createLocalOcrAdapter({ recognize: async value => ({ words: [{ text: 'PATIENT: ROBERT SMITH', confidence: 0.9, bbox: { x0: 0, y0: 0, x1: 10, y1: 4 } }], image: value }) });
  const result = await adapter.recognize(image);
  assert.equal(result.image, image);
  assert.equal(result.words[0].text, 'PATIENT: ROBERT SMITH');
});

test('recognition result adapter reports unsupported, empty, and filtered-out positioned output safely', async () => {
  const image = new Blob([await readFile('tests/hl7-toolkit/fixtures/images/synthetic-ocr.png')], { type: 'image/png' });
  const cases = [
    { data: { text: 'PRIVATE SYNTHETIC TEXT', blocks: null }, code: 'OCR_RESULT_SHAPE_UNSUPPORTED', raw: 0 },
    { data: { text: '', blocks: [] }, code: 'OCR_RESULT_EMPTY', raw: 0 },
    { data: { text: 'PRIVATE SYNTHETIC TEXT', blocks: [{ paragraphs: [{ lines: [{ text: 'PRIVATE SYNTHETIC TEXT', bbox: { x0: 10, y0: 20, x1: 10, y1: 30 } }] }] }] }, code: 'OCR_FILTER_REMOVED_ALL', raw: 1 },
  ];
  for (const { data, code, raw } of cases) {
    const states = [];
    const result = await ocr.recognizeOcrRegions({ recognize: async () => ({ data }) }, image, { onRecognitionStatus: state => states.push(state) });
    assert.equal(result.diagnosticCode, code);
    assert.equal(result.rawRegionCount, raw);
    assert.equal(result.filteredRegionCount, 0);
    assert.deepEqual(states.map(state => [state.invoked, state.completed]), [[true, false], [true, true]]);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
  }
});

test('recognition failures expose only safe codes and preserve invoked state', async () => {
  const states = [];
  await assert.rejects(ocr.recognizeOcrRegions({ recognize: async () => { throw new Error('PRIVATE OCR TEXT'); } }, new Blob(), { onRecognitionStatus: state => states.push(state) }), { message: 'OCR_RECOGNIZE_FAILED_RUNTIME' });
  assert.deepEqual(states.map(state => [state.invoked, state.completed]), [[true, false]]);
  await assert.rejects(ocr.recognizeOcrRegions({}, null), { message: 'OCR_RECOGNIZE_FAILED_INPUT' });
});

test('Tesseract 6 positioned line extraction retains word boxes for conservative table inference', async () => {
  const bbox = { x0: 10, y0: 20, x1: 300, y1: 40 };
  const data = { blocks: [{ paragraphs: [{ lines: [{ text: 'PATIENT MRN', bbox, confidence: 95, words: [
    { text: 'PATIENT', bbox: { x0: 10, y0: 20, x1: 100, y1: 40 } },
    { text: 'MRN', bbox: { x0: 220, y0: 20, x1: 270, y1: 40 } },
  ] }] }] }] };
  const result = await ocr.recognizeOcrRegions({ recognize: async () => ({ data }) }, new Blob());
  assert.deepEqual(result.words[0].words.map(word => word.text), ['PATIENT', 'MRN']);
  assert.equal(result.words[0].words[1].bbox.x0, 220);
});

test('OCR worker disposal detaches the cached worker before asynchronous termination', () => {
  const source = readFileSync('hl7-toolkit/app/scripts/image-phi-assist.mjs', 'utf8');
  assert.match(source, /async dispose\(\) \{ const pending = workerPromise; workerPromise = null; const worker = await pending\?\.catch/);
});

test('OCR startup resolves only complete Build 3 assets from the local origin', async () => {
  assert.equal(typeof ocr.probeLocalOcrAssets, 'function');
  const requested = [];
  let hideCore = false;
  const appRoot = 'dist/Kairo-HL7-Toolkit-v0.7.3-win3/app';
  const server = createServer(async (request, response) => {
    requested.push(request.url);
    if (hideCore && request.url === '/ocr/tesseract-core-lstm.wasm.js') { response.writeHead(404); response.end(); return; }
    try {
      const bytes = await readFile(join(appRoot, request.url.slice(1)));
      response.writeHead(200, { 'Content-Type': request.url.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
      response.end(bytes);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const assetBase = `http://127.0.0.1:${server.address().port}/ocr/`;
    const status = await ocr.probeLocalOcrAssets({ assetBase });
    assert.deepEqual(status, { worker: 'LOADED', core: 'LOADED', wasm: 'LOADED', traineddata: 'LOADED' });
    assert.deepEqual(requested.sort(), [
      '/ocr/lang/eng.traineddata.gz',
      '/ocr/tesseract-core-lstm.wasm',
      '/ocr/tesseract-core-lstm.wasm.js',
      '/ocr/worker.min.js',
    ].sort());
    hideCore = true;
    await assert.rejects(ocr.probeLocalOcrAssets({ assetBase }), { message: 'OCR_INIT_FAILED_WASM' });
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('staged Tesseract ESM provides the callable factory used by OCR startup', async () => {
  const bytes = await readFile('hl7-toolkit/app/ocr/tesseract.esm.min.js');
  const moduleUrl = `data:text/javascript;base64,${bytes.toString('base64')}`;
  const priorSelf = globalThis.self;
  globalThis.self = globalThis;
  try {
    const createWorker = await ocr.loadLocalTesseractWorkerFactory(moduleUrl);
    assert.equal(typeof createWorker, 'function');
  } finally { globalThis.self = priorSelf; }
});

test('Build 3 retest stages a compatible Tesseract 6.0.1, core 6.1.2, and English data set', async () => {
  const expected = {
    'tesseract.esm.min.js': '6652b51364cc5f357c057f172f24853524aa8a3f773ac7124fcd085457b75879',
    'worker.min.js': '38645599043239c0eb6db08a6504a92dcdc292200535f3e9339cd77c4443b842',
    'tesseract-core-lstm.wasm.js': '775a35df6f2ae100e02609443e6bd5cafcd07983dd6175454ca4a432a7730687',
    'tesseract-core-lstm.wasm': '220e2e87551edccb85519796a170469f8ab2a8055216789e3b8b1ada18b7bc2b',
    'lang/eng.traineddata.gz': '45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91',
  };
  for (const [name, digest] of Object.entries(expected)) {
    const bytes = await readFile(join('hl7-toolkit/app/ocr', name));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), digest, name);
    if (!['tesseract.esm.min.js', 'worker.min.js'].includes(name)) {
      const packagedBytes = await readFile(join('dist/Kairo-HL7-Toolkit-v0.7.3-win3/app/ocr', name));
      assert.equal(createHash('sha256').update(packagedBytes).digest('hex'), digest, `Build 3 ${name}`);
    }
  }
});

test('Tesseract progress phase maps failures to safe bootstrap codes', () => {
  assert.equal(ocr.bootstrapFailureCode('worker construction'), 'OCR_BOOTSTRAP_CREATE_FAILED');
  assert.equal(ocr.bootstrapFailureCode('loading tesseract core'), 'OCR_INIT_FAILED_WASM');
  assert.equal(ocr.bootstrapFailureCode('loading language traineddata'), 'OCR_BOOTSTRAP_LANGUAGE_FAILED');
  assert.equal(ocr.bootstrapFailureCode('initializing api'), 'OCR_BOOTSTRAP_INITIALIZE_FAILED');
  assert.equal(ocr.bootstrapFailureCode('private worker text'), 'OCR_INIT_FAILED_UNKNOWN');
});

test('staged classic OCR worker executes and acknowledges its bootstrap handshake', async () => {
  const workerScript = await readFile('hl7-toolkit/app/ocr/worker.min.js', 'utf8');
  const originalWorker = globalThis.Worker;
  globalThis.Worker = class {
    constructor(url) {
      assert.equal(url, '/ocr/worker.min.js');
      assert.equal(arguments.length, 1, 'packaged worker must start as a classic script');
      const context = {
        addEventListener: (type, handler) => { if (type === 'message') this.handleMessage = handler; },
        postMessage: data => queueMicrotask(() => this.onmessage?.({ data })),
      };
      context.self = context;
      context.globalThis = context;
      runInNewContext(workerScript, context, { filename: 'worker.min.js', timeout: 5000 });
      assert.equal(typeof this.handleMessage, 'function');
    }
    postMessage(data) { this.handleMessage({ data }); }
    terminate() { this.terminated = true; }
  };
  try {
    await ocr.probeLocalOcrWorker('/ocr/worker.min.js');
  } finally { globalThis.Worker = originalWorker; }
});

test('OCR worker probe distinguishes script execution failure from missing bootstrap acknowledgement', async () => {
  const originalWorker = globalThis.Worker;
  try {
    globalThis.Worker = class {
      postMessage() { queueMicrotask(() => this.onerror?.({ message: 'private script error' })); }
      terminate() {}
    };
    await assert.rejects(ocr.probeLocalOcrWorker('/ocr/worker.min.js', { timeoutMs: 30 }), { message: 'OCR_WORKER_SCRIPT_EXEC_FAILED' });
    globalThis.Worker = class { postMessage() {} terminate() {} };
    await assert.rejects(ocr.probeLocalOcrWorker('/ocr/worker.min.js', { timeoutMs: 30 }), { message: 'OCR_BOOTSTRAP_TIMEOUT' });
    globalThis.Worker = class {
      postMessage() { queueMicrotask(() => this.onmessage?.({ data: { jobId: 'ocr-bootstrap-probe', action: 'terminate', status: 'resolve', data: {} } })); }
      terminate() {}
    };
    await assert.rejects(ocr.probeLocalOcrWorker('/ocr/worker.min.js', { timeoutMs: 30 }), { message: 'OCR_BOOTSTRAP_PROTOCOL_MISMATCH' });
  } finally { globalThis.Worker = originalWorker; }
});
