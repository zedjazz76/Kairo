import { inspectImageBytes } from './image-format.mjs';
import { createBrowserRasterAdapter, sanitizeRaster } from './image-raster.mjs';
import { createImageSanitizeSession } from './image-sanitize-model.mjs';
import { createBrowserOcrAdapter, createPhiAssistModel } from './image-phi-assist.mjs';
import { createImageContentSession, sanitizedCsv } from './image-content.mjs';

export function sanitizedImageName(_sourceName, format) { return `sanitized-image.${format === 'jpeg' ? 'jpg' : 'png'}`; }

export function imageErrorMessage(error) {
  const code = String(error?.message || '');
  if (code === 'IMAGE_DICOM_UNSUPPORTED') return 'DICOM image sanitization is not supported in this checkpoint. Choose one PNG or JPEG.';
  if (code === 'IMAGE_FORMAT_UNSUPPORTED') return 'Unsupported image format. Choose one PNG or JPEG.';
  if (code === 'IMAGE_FILE_TOO_LARGE' || code === 'IMAGE_DIMENSIONS_EXCEEDED') return 'This image exceeds the local safety limits. Choose a PNG or JPEG no larger than 50 MiB, 16,384 pixels per side, and 40 megapixels.';
  return 'Could not process this image safely. Clear it and choose a supported PNG or JPEG.';
}
export function imageErrorCode(error) { const code = String(error?.message || ''); return /^IMAGE_[A-Z0-9_]+$/.test(code) ? code : 'IMAGE_PROCESSING_FAILED'; }
export function safeOcrDiagnosticCode(error) {
  const code = String(error?.message || '');
  return /^(?:OCR_INIT_FAILED_(?:WORKER|WASM|TRAINEDDATA|CSP|FETCH|UNKNOWN)|OCR_WORKER_(?:BLOCKED_CSP|URL_INVALID|SCRIPT_EXEC_FAILED|BOOTSTRAP_FAILED|UNKNOWN)|OCR_BOOTSTRAP_(?:(?:CREATE|LANGUAGE|INITIALIZE)_FAILED|PROTOCOL_MISMATCH|TIMEOUT)|OCR_RECOGNIZE_FAILED_(?:INPUT|RUNTIME)|OCR_RESULT_(?:SHAPE_UNSUPPORTED|EMPTY)|OCR_FILTER_REMOVED_ALL)$/.test(code) ? code : 'OCR_INVOCATION_FAILED';
}

export function renderRecognitionDiagnostics(root, { invoked = false, completed = false, rawRegionCount = 0, filteredRegionCount = 0 } = {}) {
  const count = value => Number.isSafeInteger(value) && value >= 0 ? String(value) : '0';
  root.querySelector('#image-recognize-invoked').textContent = invoked ? 'YES' : 'NO';
  root.querySelector('#image-recognize-completed').textContent = completed ? 'YES' : 'NO';
  root.querySelector('#image-raw-region-count').textContent = count(rawRegionCount);
  root.querySelector('#image-filtered-region-count').textContent = count(filteredRegionCount);
}

export function mountImageSanitize(root, { environment = globalThis, download } = {}) {
  const $ = selector => root.querySelector(selector);
  const session = createImageSanitizeSession({ cryptoImpl: environment.crypto });
  const adapter = createBrowserRasterAdapter(environment);
  const ocrAdapter = createBrowserOcrAdapter();
  const contentSession = createImageContentSession();
  let sourceBytes = null; let sourceBitmap = null; let sourceFile = null; let output = null; let drawing = null; let phiModel = null; let manualRedactions = []; let ocrGeneration = 0;
  let contentView = 'text';
  const setOcrDiagnostics = ({ stage, initialized = false, regionCount = 0, candidateCount = 0, renderedCount = 0, errorCode = '' }) => {
    const status = $('#image-ocr-status'); status.dataset.pipelineStage = stage; status.dataset.ocrInitialized = initialized ? 'YES' : 'NO'; status.dataset.ocrRegionCount = String(regionCount); status.dataset.phiCandidateCount = String(candidateCount); status.dataset.uiCandidatesRendered = String(renderedCount); if (errorCode) status.dataset.errorCode = errorCode; else status.removeAttribute('data-error-code');
    $('#image-ocr-engine').textContent = initialized ? 'READY' : (errorCode ? 'FAILED' : '—');
    $('#image-ocr-code').textContent = errorCode || '—';
    $('#image-ui-candidates-rendered').textContent = String(renderedCount);
  };
  const defaultDownload = (blob, name) => {
    const url = environment.URL.createObjectURL(blob); const anchor = root.createElement('a'); anchor.href = url; anchor.download = name;
    anchor.style.display = 'none'; root.body.append(anchor); anchor.click(); anchor.remove(); environment.setTimeout(() => environment.URL.revokeObjectURL(url), 0);
  };
  const saveBlob = download || defaultDownload;
  const hideError = () => { $('#image-error').hidden = true; $('#image-error').textContent = ''; $('#image-error').removeAttribute('data-code'); };
  const showError = error => { $('#image-error').textContent = imageErrorMessage(error); $('#image-error').dataset.code = imageErrorCode(error); $('#image-error').hidden = false; $('#image-review-status').textContent = ''; };
  const clearOutput = () => { output = null; $('#image-output-preview').removeAttribute('src'); $('#image-output-preview').hidden = true; $('#image-reviewed').checked = false; };
  const renderSource = () => {
    const canvas = $('#image-source-canvas'); const snapshot = session.snapshot();
    const contentCanvas = $('#image-content-source-canvas');
    if (!sourceBitmap || snapshot.state === 'EMPTY') { canvas.width = 0; canvas.height = 0; contentCanvas.width = 0; contentCanvas.height = 0; return; }
    contentCanvas.width = snapshot.width; contentCanvas.height = snapshot.height; contentCanvas.getContext('2d').drawImage(sourceBitmap, 0, 0);
    canvas.width = snapshot.width; canvas.height = snapshot.height; const context = canvas.getContext('2d'); context.drawImage(sourceBitmap, 0, 0);
    if (phiModel) for (const finding of phiModel.snapshot().findings) { context.save(); context.strokeStyle = finding.selected ? '#111827' : (finding.classification === 'LIKELY_PHI' ? '#dc2626' : '#d97706'); context.setLineDash([6, 4]); context.lineWidth = Math.max(2, Math.round(Math.min(snapshot.width, snapshot.height) / 220)); context.strokeRect(finding.rectangle.x, finding.rectangle.y, finding.rectangle.width, finding.rectangle.height); context.restore(); }
    context.fillStyle = '#000000'; context.strokeStyle = '#ffffff'; context.lineWidth = Math.max(1, Math.round(Math.min(snapshot.width, snapshot.height) / 400));
    for (const rectangle of snapshot.redactions) { context.fillRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height); context.strokeRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height); }
  };
  const renderPhi = () => {
    const list = $('#image-phi-findings'); list.replaceChildren(); const summary = phiModel?.snapshot() || { detectedTextRegions: 0, likelyPhi: 0, possiblePhi: 0, selectedForRedaction: 0, findings: [] };
    $('#image-detected-text-count').textContent = String(summary.detectedTextRegions); $('#image-likely-phi-count').textContent = String(summary.likelyPhi); $('#image-possible-phi-count').textContent = String(summary.possiblePhi); $('#image-selected-phi-count').textContent = String(summary.selectedForRedaction);
    $('#image-phi-approve-likely').disabled = !summary.detectedTextRegions; $('#image-phi-approve-all').disabled = !summary.detectedTextRegions; $('#image-phi-clear-selection').disabled = !summary.selectedForRedaction;
    let renderedCount = 0;
    for (const finding of summary.findings) { const item = root.createElement('li'); const checkbox = root.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = finding.selected; checkbox.id = `image-phi-${finding.id}`; checkbox.addEventListener('change', () => { phiModel.toggle(finding.id); syncRedactions(); }); const label = root.createElement('label'); label.htmlFor = checkbox.id; label.textContent = `${finding.classification} · ${Math.round(finding.confidence * 100)}% confidence · ${finding.rectangle.width} × ${finding.rectangle.height} px`; item.append(checkbox, label); list.append(item); if (finding.classification !== 'NOT_CLASSIFIED') renderedCount += 1; }
    return { regionCount: summary.detectedTextRegions, candidateCount: summary.likelyPhi + summary.possiblePhi, renderedCount };
  };
  const renderState = () => {
    const snapshot = session.snapshot(); const loaded = snapshot.state !== 'EMPTY';
    $('#image-metadata-status').textContent = loaded ? snapshot.metadataStatus : 'METADATA NEEDS REVIEW';
    $('#image-pixel-status').textContent = loaded ? snapshot.pixelStatus : 'PIXEL CONTENT NOT REVIEWED';
    $('#image-redaction-count').textContent = String(snapshot.redactions?.length || 0);
    $('#image-undo').disabled = !snapshot.redactions?.length; $('#image-reset').disabled = !loaded; $('#image-preview').disabled = !loaded;
    $('#image-reviewed').disabled = !['PREVIEW_READY_UNREVIEWED', 'REVIEW_COMPLETE', 'EXPORTED'].includes(snapshot.state);
    $('#image-save').disabled = !snapshot.exportable;
    $('#image-review-status').textContent = snapshot.reviewComplete ? 'SANITIZATION REVIEW COMPLETE' : '';
    if (loaded) $('#image-metadata-detail').textContent = snapshot.metadataDetected ? `Source metadata containers detected: ${snapshot.metadataCategories.join(', ')} (${snapshot.metadataCount}). Raw values are not displayed or logged.` : 'No supported source metadata containers detected.';
    else $('#image-metadata-detail').textContent = 'No source inspected.';
  };
  const renderTable = (id, table) => {
    const host = $(id); host.replaceChildren();
    if (table?.status !== 'READY') return;
    const element = root.createElement('table');
    for (const row of table.rows) { const tr = root.createElement('tr'); for (const value of row) { const td = root.createElement('td'); td.textContent = value; tr.append(td); } element.append(tr); }
    host.append(element);
  };
  const renderContent = () => {
    const extracted = contentSession.extracted(); const sanitized = contentSession.sanitized();
    $('#image-content-extracted-text').value = extracted.text;
    $('#image-content-sanitized-text').value = sanitized?.text || '';
    renderTable('#image-content-extracted-table', extracted.table); renderTable('#image-content-sanitized-table', sanitized?.table);
    $('#image-content-table-status').textContent = extracted.table.status === 'READY' ? 'TABLE STRUCTURE DETECTED · Review cell alignment' : 'TABLE STRUCTURE UNCERTAIN · Text mode preserved';
    for (const [id, view] of [['#image-content-text-view', 'text'], ['#image-content-table-view', 'table']]) $(id).setAttribute('aria-pressed', String(contentView === view));
    for (const id of ['#image-content-extracted-text', '#image-content-sanitized-text']) $(id).hidden = contentView !== 'text';
    for (const id of ['#image-content-extracted-table', '#image-content-sanitized-table']) $(id).hidden = contentView !== 'table';
    $('#image-content-table-view').disabled = extracted.table.status !== 'READY';
    $('#image-content-extract').disabled = !sourceFile;
    $('#image-content-sanitize').disabled = !extracted.text;
    $('#image-content-reviewed').disabled = !sanitized;
    const approved = Boolean(sanitized && $('#image-content-reviewed').checked);
    $('#image-content-copy-text').disabled = !approved;
    $('#image-content-copy-table').disabled = !approved || sanitized.table.status !== 'READY';
    $('#image-content-export-csv').disabled = !approved || sanitized.table.status !== 'READY';
    const list = $('#image-content-review'); list.replaceChildren();
    for (const item of contentSession.review()) { const li = root.createElement('li'); li.textContent = `${item.category.toUpperCase()}: ${item.source} → ${item.replacement}`; list.append(li); }
  };
  const invalidateOutput = () => { clearOutput(); renderState(); };
  const syncRedactions = () => { session.reset(); for (const rectangle of [...manualRedactions, ...(phiModel?.selectedRectangles() || [])]) session.addRedaction(rectangle); clearOutput(); renderSource(); renderPhi(); renderState(); };
  const addRectangle = rectangle => { manualRedactions.push(rectangle); syncRedactions(); };
  const resetAll = () => { ocrGeneration += 1; void ocrAdapter.dispose(); session.clear(); contentSession.clear(); sourceBytes = null; sourceBitmap = null; sourceFile = null; phiModel = null; manualRedactions = []; contentView = 'text'; clearOutput(); $('#image-file').value = ''; $('#image-source-status').textContent = 'Select one local image.'; $('#image-ocr-status').textContent = 'Detect visible text locally after selecting an image.'; $('#image-content-ocr-status').textContent = 'Select a local image, then extract.'; $('#image-content-assurance').textContent = ''; $('#image-content-reviewed').checked = false; for (const id of ['image-worker-asset', 'image-wasm-asset', 'image-traineddata-asset']) $(`#${id}`).textContent = '—'; renderRecognitionDiagnostics(root); setOcrDiagnostics({ stage: 'EMPTY' }); hideError(); renderSource(); renderPhi(); renderState(); renderContent(); };
  const open = () => { $('#quick-selector').hidden = true; $('#quick-text-view').hidden = true; $('#quick-inline-guide').hidden = true; $('#quick-image-view').hidden = false; $('#quick-title').textContent = 'Extract & Sanitize Content from a PNG or JPEG.'; $('#image-file').focus(); };
  const showSelector = () => { $('#quick-selector').hidden = false; $('#quick-text-view').hidden = true; $('#quick-image-view').hidden = true; $('#quick-inline-guide').hidden = true; $('#quick-title').textContent = 'Choose what to sanitize.'; $('#quick-text-open').focus(); };
  const guide = (kind) => {
    $('#quick-selector').hidden = true; $('#quick-text-view').hidden = true; $('#quick-image-view').hidden = true; $('#quick-inline-guide').hidden = false;
    const image = kind === 'image'; $('#quick-inline-guide-title').textContent = image ? 'Image Sanitize Quick Guide' : 'HL7 / Text Sanitize Quick Guide';
    $('#quick-inline-guide-purpose').textContent = image ? 'Extract local OCR text or cells, sanitize identifiers, and review before copying. Optional pixel-redacted image output remains available.' : 'Prepare pasted HL7 or text with the existing local patient-PHI rules.';
    const steps = $('#quick-inline-guide-steps'); steps.replaceChildren();
    for (const text of image ? ['Choose one PNG or JPEG.', 'Extract local OCR content and inspect text or detected table cells.', 'Sanitize and review every identifier and remaining line.', 'Confirm review, then copy sanitized text/table or export sanitized CSV.'] : ['Paste authorized text.', 'Run the sanitizer.', 'Review output and every warning.', 'Copy only after review.']) { const item = root.createElement('li'); item.textContent = text; steps.append(item); }
    $('#quick-inline-guide-result').textContent = image ? 'Automated extraction and identifier detection may miss information. Review the sanitized output before sharing.' : 'Sanitized text remains subject to analyst review and organizational policy.';
  };
  $('#quick-image-open').addEventListener('click', open); $('#quick-image-back').addEventListener('click', () => { resetAll(); showSelector(); });
  $('#quick-image-guide').addEventListener('click', () => guide('image')); $('#quick-text-guide').addEventListener('click', () => guide('text')); $('#quick-guide-back').addEventListener('click', showSelector);
  const runOcr = async () => {
    if (!sourceFile || !phiModel) return;
    const file = sourceFile; const currentOcrGeneration = ++ocrGeneration;
    contentSession.clear(); contentView = 'text'; $('#image-content-reviewed').checked = false; $('#image-content-assurance').textContent = '';
    $('#image-content-ocr-status').textContent = 'Local OCR running…'; $('#image-ocr-status').textContent = 'Detecting visible text locally…';
    renderContent(); $('#image-content-extract').disabled = true; setOcrDiagnostics({ stage: 'OCR_INVOKED' });
    try {
      const recognized = await ocrAdapter.recognize(file, {
        onAssetStatus: (name, status) => { if (currentOcrGeneration !== ocrGeneration) return; const id = name === 'worker' ? 'image-worker-asset' : name === 'traineddata' ? 'image-traineddata-asset' : 'image-wasm-asset'; if (name !== 'core' || status === 'FAILED') $(`#${id}`).textContent = status; },
        onRecognitionStatus: status => { if (currentOcrGeneration === ocrGeneration) renderRecognitionDiagnostics(root, status); },
      });
      if (currentOcrGeneration !== ocrGeneration || !phiModel) return;
      phiModel.setFindings(recognized.words); contentSession.load(recognized.words);
      const rendered = renderPhi(); renderSource(); renderContent();
      setOcrDiagnostics({ stage: 'UI_RENDERED', initialized: recognized.initialized === true, regionCount: rendered.regionCount, candidateCount: rendered.candidateCount, renderedCount: rendered.renderedCount, errorCode: recognized.diagnosticCode });
      $('#image-content-ocr-status').textContent = recognized.diagnosticCode ? `OCR completed · ${recognized.diagnosticCode} · Review the source image.` : `OCR EXTRACTION COMPLETE · ${recognized.filteredRegionCount} text regions. Review extracted content.`;
      $('#image-ocr-status').textContent = recognized.diagnosticCode ? 'Local OCR completed without usable positioned text. Final visual review and manual redaction are still required.' : 'AUTOMATED PHI REVIEW ASSISTANCE COMPLETE · Review each highlighted finding and the complete image.';
    } catch (ocrError) {
      if (currentOcrGeneration !== ocrGeneration) return;
      const code = ocrError?.message === 'IMAGE_CONTENT_LIMIT' ? 'IMAGE_CONTENT_LIMIT' : safeOcrDiagnosticCode(ocrError);
      setOcrDiagnostics({ stage: code, errorCode: code, initialized: $('#image-recognize-invoked').textContent === 'YES' });
      $('#image-content-ocr-status').textContent = code === 'IMAGE_CONTENT_LIMIT' ? 'OCR output exceeds the bounded extraction limit. No partial content is available to copy or export.' : `Local OCR unavailable · ${code}. No content is ready to sanitize.`;
      $('#image-ocr-status').textContent = code === 'IMAGE_CONTENT_LIMIT' ? 'OCR completed, but text extraction exceeded the content limit. Manual image review is still required.' : 'Local PHI review assistance unavailable. Final visual review and manual redaction are still required.';
    } finally { if (currentOcrGeneration === ocrGeneration) renderContent(); }
  };
  $('#image-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return; resetAll(); const loadToken = ocrGeneration; sourceFile = file; $('#image-file').disabled = true; $('#image-source-status').textContent = 'Reading one local image…';
    try {
      const bytes = new Uint8Array(await file.arrayBuffer()); if (loadToken !== ocrGeneration) return;
      sourceBytes = bytes; const inspection = inspectImageBytes(sourceBytes); const bitmap = await adapter.decode(sourceBytes, inspection.format);
      if (loadToken !== ocrGeneration) { adapter.dispose(bitmap); return; }
      if (bitmap.width !== inspection.width || bitmap.height !== inspection.height) { adapter.dispose(bitmap); throw new Error('IMAGE_DECODE_DIMENSIONS_MISMATCH'); }
      sourceBitmap = bitmap; const loadedGeneration = await session.loadSource({ bytes: sourceBytes, inspection, readAgain: () => file.arrayBuffer(), dispose: () => { adapter.dispose(bitmap); if (sourceBitmap === bitmap) sourceBitmap = null; } });
      if (loadToken !== ocrGeneration) { if (session.snapshot().generation === loadedGeneration) session.clear(); return; }
      phiModel = createPhiAssistModel({ width: inspection.width, height: inspection.height });
      $('#image-output-format').value = inspection.format; $('#image-source-status').textContent = `Loaded locally: ${inspection.format.toUpperCase()} · ${inspection.width} × ${inspection.height} pixels.`;
      renderSource(); renderPhi(); hideError(); renderState(); renderContent(); $('#image-content-ocr-status').textContent = 'Image loaded. Select Extract to run local OCR.';
    } catch (error) { if (loadToken === ocrGeneration) { resetAll(); showError(error); } }
    finally { $('#image-file').disabled = false; }
  });
  $('#image-content-extract').addEventListener('click', runOcr);
  $('#image-content-text-view').addEventListener('click', () => { contentView = 'text'; renderContent(); });
  $('#image-content-table-view').addEventListener('click', () => { if (contentSession.extracted().table.status === 'READY') { contentView = 'table'; renderContent(); } });
  $('#image-content-sanitize').addEventListener('click', () => { contentSession.sanitize(); $('#image-content-reviewed').checked = false; $('#image-content-assurance').textContent = 'SANITIZED CONTENT READY · Review detected identifiers and all remaining content.'; renderContent(); });
  $('#image-content-reviewed').addEventListener('change', () => { $('#image-content-assurance').textContent = $('#image-content-reviewed').checked ? 'IDENTIFIER REVIEW COMPLETE · SANITIZED CONTENT READY' : 'SANITIZED CONTENT READY · Review required before copy or export.'; renderContent(); });
  const copyContent = async value => { try { await environment.navigator.clipboard.writeText(value); $('#image-content-assurance').textContent = 'Sanitized content copied. Review it before sharing.'; } catch { $('#image-content-assurance').textContent = 'Clipboard unavailable. No content was copied.'; } };
  $('#image-content-copy-text').addEventListener('click', () => { if ($('#image-content-reviewed').checked && contentSession.sanitized()) void copyContent(contentSession.sanitized().text); });
  $('#image-content-copy-table').addEventListener('click', () => { if ($('#image-content-reviewed').checked && contentSession.sanitized()?.table.status === 'READY') void copyContent(sanitizedCsv(contentSession.sanitized().table)); });
  $('#image-content-export-csv').addEventListener('click', () => { if ($('#image-content-reviewed').checked && contentSession.sanitized()?.table.status === 'READY') saveBlob(new Blob([sanitizedCsv(contentSession.sanitized().table)], { type: 'text/csv;charset=utf-8' }), 'sanitized-image-content.csv'); });
  $('#image-content-clear').addEventListener('click', resetAll);
  $('#image-add-redaction').addEventListener('click', () => { try { addRectangle({ x: $('#image-redact-x').value, y: $('#image-redact-y').value, width: $('#image-redact-width').value, height: $('#image-redact-height').value }); hideError(); } catch (error) { showError(error); } });
  const canvas = $('#image-source-canvas');
  canvas.addEventListener('pointerdown', event => { if (!sourceBitmap) return; const bounds = canvas.getBoundingClientRect(); drawing = { x: (event.clientX - bounds.left) * canvas.width / bounds.width, y: (event.clientY - bounds.top) * canvas.height / bounds.height }; canvas.setPointerCapture?.(event.pointerId); });
  canvas.addEventListener('pointerup', event => { if (!drawing) return; const start = drawing; drawing = null; const bounds = canvas.getBoundingClientRect(); const x = (event.clientX - bounds.left) * canvas.width / bounds.width; const y = (event.clientY - bounds.top) * canvas.height / bounds.height; try { addRectangle({ x: start.x, y: start.y, width: x - start.x, height: y - start.y }); hideError(); } catch (error) { showError(error); } });
  $('#image-undo').addEventListener('click', () => { if (manualRedactions.length) manualRedactions.pop(); else phiModel?.clearSelection(); syncRedactions(); });
  $('#image-reset').addEventListener('click', () => { manualRedactions = []; phiModel?.clearSelection(); syncRedactions(); }); $('#image-clear').addEventListener('click', resetAll);
  $('#image-phi-approve-likely').addEventListener('click', () => { phiModel?.approveLikelyPhi(); syncRedactions(); });
  $('#image-phi-approve-all').addEventListener('click', () => { phiModel?.approveAllText(); syncRedactions(); });
  $('#image-phi-clear-selection').addEventListener('click', () => { phiModel?.clearSelection(); syncRedactions(); });
  $('#image-output-format').addEventListener('change', () => { if (session.snapshot().state !== 'EMPTY') session.invalidatePreview(); invalidateOutput(); });
  $('#image-preview').addEventListener('click', async () => {
    const generation = session.snapshot().generation; $('#image-preview').disabled = true; hideError();
    try {
      const format = $('#image-output-format').value; const result = await sanitizeRaster({ sourceBytes, inspection: { format: session.snapshot().format, width: session.snapshot().width, height: session.snapshot().height }, rectangles: session.snapshot().redactions, outputFormat: format, adapter });
      const url = environment.URL.createObjectURL(result.blob); session.setPreview({ outputFormat: format, verified: true, dispose: () => environment.URL.revokeObjectURL(url) }, generation); output = result;
      $('#image-output-preview').src = url; $('#image-output-preview').hidden = false; renderState();
    } catch (error) { showError(error); } finally { if (session.snapshot().state !== 'EMPTY') $('#image-preview').disabled = false; }
  });
  $('#image-reviewed').addEventListener('change', () => { try { session.confirmPixelReview($('#image-reviewed').checked); renderState(); } catch (error) { showError(error); } });
  $('#image-save').addEventListener('click', async () => { try { const { outputFormat } = await session.assertExportable(); saveBlob(output.blob, sanitizedImageName(sourceFile.name, outputFormat)); session.markExported(); renderState(); } catch (error) { showError(error); renderState(); } });
  $('#quick-dialog').addEventListener('close', resetAll); renderState(); renderContent();
  return { open, clear: resetAll, getSnapshot: () => session.snapshot() };
}
