const LABELS = /\b(PATIENT|PATIENT NAME|MRN|MEDICAL RECORD|PATIENT ID|DOB|BIRTH DATE|DATE OF BIRTH|ACCESSION|ACC|ORDER|PHYSICIAN|PROVIDER|FACILITY|INSTITUTION|HOSPITAL|CLINIC)\b/i;
const DATE = /\b(?:0?[1-9]|1[0-2])[\/-](?:0?[1-9]|[12]\d|3[01])[\/-](?:19|20)\d{2}\b/;
const PHONE = /\b(?:\+?\d[\d ().-]{7,}\d)\b/;
const EMAIL = /\b[^\s@]+@[^\s@]+\.[A-Za-z]{2,}\b/;
const IDENTIFIER = /\b(?=[A-Z0-9-]{5,}\b)(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z0-9-]+\b/;

export function classifyOcrText(value) {
  const text = String(value ?? '').trim();
  if (!text) return 'NOT_CLASSIFIED';
  if (LABELS.test(text) || DATE.test(text)) return 'LIKELY_PHI';
  if (PHONE.test(text) || EMAIL.test(text) || IDENTIFIER.test(text)) return 'POSSIBLE_PHI';
  return 'NOT_CLASSIFIED';
}

function rectangleFrom(bbox, width, height) {
  const x0 = Math.max(0, Math.min(width, Math.floor(Number(bbox?.x0))));
  const y0 = Math.max(0, Math.min(height, Math.floor(Number(bbox?.y0))));
  const x1 = Math.max(0, Math.min(width, Math.ceil(Number(bbox?.x1))));
  const y1 = Math.max(0, Math.min(height, Math.ceil(Number(bbox?.y1))));
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

export function normalizeOcrWords(words, { width, height }) {
  return (Array.isArray(words) ? words : []).map((word, index) => {
    const rectangle = rectangleFrom(word?.bbox, width, height);
    const text = String(word?.text ?? '').trim();
    if (!rectangle || !text) return null;
    const rawConfidence = Number(word?.confidence);
    const confidence = Math.max(0, Math.min(1, rawConfidence > 1 ? rawConfidence / 100 : rawConfidence));
    return { id: `ocr-${index + 1}`, text, confidence, rectangle, classification: classifyOcrText(text) };
  }).filter(Boolean);
}

export function createPhiAssistModel({ width, height, maxFindings = 500 }) {
  let findings = [];
  const project = finding => ({ id: finding.id, classification: finding.classification, confidence: finding.confidence, rectangle: { ...finding.rectangle }, selected: finding.selected });
  const setSelected = predicate => { findings = findings.map(finding => predicate(finding) ? { ...finding, selected: true } : finding); };
  return {
    setFindings(words) { findings = normalizeOcrWords(words, { width, height }).slice(0, maxFindings).map(finding => ({ ...finding, selected: false })); },
    approveLikelyPhi() { setSelected(finding => finding.classification === 'LIKELY_PHI'); },
    approveAllText() { setSelected(() => true); },
    toggle(id) { findings = findings.map(finding => finding.id === id ? { ...finding, selected: !finding.selected } : finding); },
    clearSelection() { findings = findings.map(finding => ({ ...finding, selected: false })); },
    selectedRectangles() { return findings.filter(finding => finding.selected).map(finding => ({ ...finding.rectangle })); },
    snapshot() { return { detectedTextRegions: findings.length, likelyPhi: findings.filter(f => f.classification === 'LIKELY_PHI').length, possiblePhi: findings.filter(f => f.classification === 'POSSIBLE_PHI').length, selectedForRedaction: findings.filter(f => f.selected).length, findings: findings.map(project) }; },
  };
}

export function createLocalOcrAdapter({ recognize } = {}) {
  return { async recognize(image, options) { if (typeof recognize !== 'function') throw new Error('IMAGE_OCR_UNAVAILABLE'); return recognize(image, options); } };
}

function ocrAssetPaths(assetBase) {
  const base = assetBase.endsWith('/') ? assetBase : `${assetBase}/`;
  return {
    module: `${base}tesseract.esm.min.js`,
    worker: `${base}worker.min.js`,
    core: `${base}tesseract-core-lstm.wasm.js`,
    wasm: `${base}tesseract-core-lstm.wasm`,
    traineddata: `${base}lang/eng.traineddata.gz`,
    lang: `${base}lang`,
  };
}

export async function probeLocalOcrAssets({ assetBase = '/ocr/', fetchImpl = globalThis.fetch, onAssetStatus = () => {} } = {}) {
  const paths = ocrAssetPaths(assetBase);
  const status = { worker: 'FAILED', core: 'FAILED', wasm: 'FAILED', traineddata: 'FAILED' };
  for (const [name, code] of [['worker', 'OCR_INIT_FAILED_WORKER'], ['core', 'OCR_INIT_FAILED_WASM'], ['wasm', 'OCR_INIT_FAILED_WASM'], ['traineddata', 'OCR_INIT_FAILED_TRAINEDDATA']]) {
    try {
      const response = await fetchImpl(paths[name], { cache: 'no-store' });
      if (!response.ok || (name === 'worker' || name === 'core') && !/^(text|application)\/javascript/i.test(response.headers.get('content-type') || '')) throw new Error(code);
      if (!(await response.arrayBuffer()).byteLength) throw new Error(code);
      status[name] = 'LOADED';
      onAssetStatus(name, 'LOADED');
    } catch { onAssetStatus(name, 'FAILED'); throw new Error(code); }
  }
  return status;
}

export async function probeLocalOcrWorker(workerPath, { timeoutMs = 8000 } = {}) {
  let worker;
  try { worker = new Worker(workerPath); }
  catch (error) {
    if (error?.name === 'SecurityError') throw new Error('OCR_WORKER_BLOCKED_CSP');
    if (error?.name === 'SyntaxError') throw new Error('OCR_WORKER_URL_INVALID');
    throw new Error('OCR_WORKER_UNKNOWN');
  }
  let cspBlocked = false;
  const onCspViolation = event => { if (event.effectiveDirective === 'worker-src') cspBlocked = true; };
  globalThis.document?.addEventListener?.('securitypolicyviolation', onCspViolation);
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(cspBlocked ? 'OCR_WORKER_BLOCKED_CSP' : 'OCR_BOOTSTRAP_TIMEOUT')), timeoutMs);
      const finish = error => { clearTimeout(timer); if (error) reject(error); else resolve(); };
      worker.onerror = () => finish(new Error(cspBlocked ? 'OCR_WORKER_BLOCKED_CSP' : 'OCR_WORKER_SCRIPT_EXEC_FAILED'));
      worker.onmessageerror = () => finish(new Error('OCR_BOOTSTRAP_PROTOCOL_MISMATCH'));
      worker.onmessage = event => {
        const message = event.data;
        if (message?.jobId !== 'ocr-bootstrap-probe' || message?.action !== 'terminate') return;
        finish(message.status === 'resolve' && message.data?.terminated === true ? null : new Error('OCR_BOOTSTRAP_PROTOCOL_MISMATCH'));
      };
      try { worker.postMessage({ workerId: 'ocr-bootstrap-probe', jobId: 'ocr-bootstrap-probe', action: 'terminate', payload: {} }); }
      catch { finish(new Error('OCR_BOOTSTRAP_PROTOCOL_MISMATCH')); }
    });
  } finally {
    worker.terminate();
    globalThis.document?.removeEventListener?.('securitypolicyviolation', onCspViolation);
  }
}

export async function loadLocalTesseractWorkerFactory(moduleUrl) {
  let bundle;
  try { bundle = await import(moduleUrl); }
  catch { throw new Error('OCR_INIT_FAILED_FETCH'); }
  const createWorker = bundle.default?.createWorker;
  if (typeof createWorker !== 'function') throw new Error('OCR_BOOTSTRAP_CREATE_FAILED');
  return createWorker;
}

export function bootstrapFailureCode(stage) {
  if (stage === 'worker construction') return 'OCR_BOOTSTRAP_CREATE_FAILED';
  if (stage === 'loading tesseract core' || stage === 'initializing tesseract') return 'OCR_INIT_FAILED_WASM';
  if (stage === 'loading language traineddata') return 'OCR_BOOTSTRAP_LANGUAGE_FAILED';
  if (stage === 'initializing api') return 'OCR_BOOTSTRAP_INITIALIZE_FAILED';
  return 'OCR_INIT_FAILED_UNKNOWN';
}

export async function recognizeOcrRegions(worker, image, { onRecognitionStatus = () => {} } = {}) {
  if (image == null) throw new Error('OCR_RECOGNIZE_FAILED_INPUT');
  onRecognitionStatus({ invoked: true, completed: false, rawRegionCount: 0, filteredRegionCount: 0 });
  let result;
  try { result = await worker.recognize(image, { rotateAuto: true }, { blocks: true }); }
  catch { throw new Error('OCR_RECOGNIZE_FAILED_RUNTIME'); }
  const blocks = result?.data?.blocks;
  const rawRegions = Array.isArray(blocks)
    ? blocks.flatMap(block => (block.paragraphs || []).flatMap(paragraph => paragraph.lines || []))
    : [];
  const words = rawRegions.filter(region => {
    const bbox = region?.bbox;
    return typeof region?.text === 'string' && region.text.trim().length > 0
      && [bbox?.x0, bbox?.y0, bbox?.x1, bbox?.y1].every(Number.isFinite)
      && bbox.x1 > bbox.x0 && bbox.y1 > bbox.y0;
  }).map(region => ({ text: region.text, confidence: region.confidence, bbox: region.bbox,
    words: (Array.isArray(region.words) ? region.words : []).filter(word => typeof word?.text === 'string' && word.text.trim()
      && [word?.bbox?.x0, word?.bbox?.y0, word?.bbox?.x1, word?.bbox?.y1].every(Number.isFinite)
      && word.bbox.x1 > word.bbox.x0 && word.bbox.y1 > word.bbox.y0)
      .map(word => ({ text: word.text, bbox: word.bbox })),
  }));
  const rawRegionCount = rawRegions.length;
  const filteredRegionCount = words.length;
  onRecognitionStatus({ invoked: true, completed: true, rawRegionCount, filteredRegionCount });
  const diagnosticCode = !Array.isArray(blocks) ? 'OCR_RESULT_SHAPE_UNSUPPORTED'
    : !rawRegionCount ? 'OCR_RESULT_EMPTY'
      : !filteredRegionCount ? 'OCR_FILTER_REMOVED_ALL' : '';
  return { initialized: true, words, rawRegionCount, filteredRegionCount, diagnosticCode };
}

export function createBrowserOcrAdapter({ assetBase = '/ocr/' } = {}) {
  let workerPromise;
  const paths = ocrAssetPaths(assetBase);
  return {
    async recognize(image, { onAssetStatus = () => {}, onRecognitionStatus = () => {} } = {}) {
      if (!workerPromise) workerPromise = (async () => {
        await probeLocalOcrAssets({ assetBase, onAssetStatus });
        const createWorker = await loadLocalTesseractWorkerFactory(paths.module);
        await probeLocalOcrWorker(paths.worker);
        let stage = 'worker construction';
        try {
          return await createWorker('eng', 1, {
            workerPath: paths.worker, corePath: paths.core, langPath: paths.lang,
            cacheMethod: 'none', logger: event => { stage = event.status; }, workerBlobURL: false,
          });
        } catch (error) {
          if (error?.name === 'SecurityError' || /Content Security Policy|CSP|Refused to create a worker/i.test(String(error?.message || error))) throw new Error('OCR_WORKER_BLOCKED_CSP');
          throw new Error(bootstrapFailureCode(stage));
        }
      })();
      const worker = await workerPromise;
      return recognizeOcrRegions(worker, image, { onRecognitionStatus });
    },
    async dispose() { const pending = workerPromise; workerPromise = null; const worker = await pending?.catch(() => null); await worker?.terminate?.(); },
  };
}
