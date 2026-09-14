const fail = code => { throw new Error(code); };
const hex = bytes => [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
async function digest(cryptoImpl, bytes) { return hex(await cryptoImpl.subtle.digest('SHA-256', bytes)); }
function normalized(rectangle, width, height) {
  let x1 = Math.round(Number(rectangle.x)); let y1 = Math.round(Number(rectangle.y));
  let x2 = Math.round(Number(rectangle.x) + Number(rectangle.width)); let y2 = Math.round(Number(rectangle.y) + Number(rectangle.height));
  if (![x1, y1, x2, y2].every(Number.isFinite)) fail('IMAGE_REDACTION_INVALID');
  if (x2 < x1) [x1, x2] = [x2, x1]; if (y2 < y1) [y1, y2] = [y2, y1];
  x1 = Math.max(0, Math.min(width, x1)); x2 = Math.max(0, Math.min(width, x2));
  y1 = Math.max(0, Math.min(height, y1)); y2 = Math.max(0, Math.min(height, y2));
  if (x2 <= x1 || y2 <= y1) fail('IMAGE_REDACTION_EMPTY');
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

export function createImageSanitizeSession({ cryptoImpl = globalThis.crypto, maxRedactions = 100 } = {}) {
  let generation = 0; let source = null; let preview = null; let redactions = []; let reviewed = false;
  const disposePreview = () => { try { preview?.dispose?.(); } finally { preview = null; } };
  const invalidate = state => { disposePreview(); reviewed = false; if (source) source.state = state; };
  const requireSource = () => { if (!source) fail('IMAGE_SOURCE_REQUIRED'); };
  return {
    async loadSource({ bytes, inspection, readAgain, dispose }) {
      this.clear();
      const copy = bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes);
      source = { state: 'SOURCE_LOADING', inspection, readAgain, dispose, hash: await digest(cryptoImpl, copy) };
      source.state = 'SOURCE_READY_UNREVIEWED'; return generation;
    },
    addRedaction(rectangle) { requireSource(); if (redactions.length >= maxRedactions) fail('IMAGE_REDACTION_LIMIT'); redactions.push(normalized(rectangle, source.inspection.width, source.inspection.height)); invalidate('EDITING_UNREVIEWED'); },
    undo() { requireSource(); if (redactions.length) redactions.pop(); invalidate(redactions.length ? 'EDITING_UNREVIEWED' : 'SOURCE_READY_UNREVIEWED'); },
    reset() { requireSource(); redactions = []; invalidate('SOURCE_READY_UNREVIEWED'); },
    invalidatePreview() { requireSource(); invalidate(redactions.length ? 'EDITING_UNREVIEWED' : 'SOURCE_READY_UNREVIEWED'); },
    setPreview(value, operationGeneration = generation) { if (operationGeneration !== generation) fail('IMAGE_STALE_OPERATION'); requireSource(); if (!value?.verified) fail('IMAGE_OUTPUT_NOT_VERIFIED'); disposePreview(); preview = value; reviewed = false; source.state = 'PREVIEW_READY_UNREVIEWED'; },
    confirmPixelReview(value) { requireSource(); if (!preview) fail('IMAGE_PREVIEW_REQUIRED'); reviewed = value === true; source.state = reviewed ? 'REVIEW_COMPLETE' : 'PREVIEW_READY_UNREVIEWED'; },
    async assertExportable() {
      requireSource(); if (!preview?.verified) fail('IMAGE_OUTPUT_NOT_VERIFIED'); if (!reviewed) fail('IMAGE_PIXEL_REVIEW_REQUIRED');
      const current = new Uint8Array(await source.readAgain()); if (await digest(cryptoImpl, current) !== source.hash) fail('IMAGE_SOURCE_CHANGED');
      return { outputFormat: preview.outputFormat };
    },
    markExported() { requireSource(); if (!reviewed || !preview) fail('IMAGE_EXPORT_NOT_READY'); source.state = 'EXPORTED'; },
    clear() { disposePreview(); try { source?.dispose?.(); } finally { source = null; redactions = []; reviewed = false; generation += 1; } },
    snapshot() {
      if (!source) return { state: 'EMPTY', generation };
      const metadataDetected = source.inspection.metadata.status === 'present';
      const metadataStatus = preview?.verified ? (metadataDetected ? 'METADATA SANITIZED' : 'METADATA NOT APPLICABLE') : 'METADATA NEEDS REVIEW';
      return { state: source.state, generation, format: source.inspection.format, width: source.inspection.width, height: source.inspection.height,
        metadataDetected, metadataCategories: [...source.inspection.metadata.categories], metadataCount: source.inspection.metadata.count, metadataStatus,
        pixelStatus: reviewed ? 'PIXEL CONTENT REVIEWED' : 'PIXEL CONTENT NOT REVIEWED', redactions: redactions.map(value => ({ ...value })),
        reviewComplete: Boolean(preview?.verified && reviewed), exportable: Boolean(preview?.verified && reviewed) };
    },
  };
}
