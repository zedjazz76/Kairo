import assert from 'node:assert/strict';
import test from 'node:test';
import { createImageSanitizeSession } from '../../hl7-toolkit/app/scripts/image-sanitize-model.mjs';

const inspection = { format: 'png', width: 10, height: 8, metadata: { status: 'present', categories: ['EXIF'], count: 1 } };
const bytes = new Uint8Array([1, 2, 3, 4]);

test('loads only projected source state and exposes approved assurance language', async () => {
  const session = createImageSanitizeSession();
  await session.loadSource({ bytes, inspection, readAgain: async () => bytes });
  assert.deepEqual(session.snapshot(), { state: 'SOURCE_READY_UNREVIEWED', generation: 1, format: 'png', width: 10, height: 8, metadataDetected: true, metadataCategories: ['EXIF'], metadataCount: 1, metadataStatus: 'METADATA NEEDS REVIEW', pixelStatus: 'PIXEL CONTENT NOT REVIEWED', redactions: [], reviewComplete: false, exportable: false });
  assert.doesNotMatch(JSON.stringify(session.snapshot()), /01020304|1,2,3,4/);
});

test('normalizes multiple rectangles and undo/reset invalidate preview and review', async () => {
  const session = createImageSanitizeSession(); await session.loadSource({ bytes, inspection, readAgain: async () => bytes });
  session.addRedaction({ x: 8.7, y: 7.2, width: -5.1, height: -4.4 });
  session.addRedaction({ x: -2, y: -2, width: 4, height: 4 });
  assert.deepEqual(session.snapshot().redactions, [{ x: 4, y: 3, width: 5, height: 4 }, { x: 0, y: 0, width: 2, height: 2 }]);
  session.setPreview({ outputFormat: 'png', verified: true, dispose() {} }); session.confirmPixelReview(true);
  assert.equal(session.snapshot().reviewComplete, true);
  session.undo(); assert.equal(session.snapshot().redactions.length, 1); assert.equal(session.snapshot().reviewComplete, false);
  session.reset(); assert.equal(session.snapshot().redactions.length, 0); assert.equal(session.snapshot().state, 'SOURCE_READY_UNREVIEWED');
});

test('requires verified preview, explicit review and unchanged source hash', async () => {
  let current = bytes; const session = createImageSanitizeSession();
  await session.loadSource({ bytes, inspection, readAgain: async () => current });
  assert.throws(() => session.confirmPixelReview(true), /IMAGE_PREVIEW_REQUIRED/);
  session.setPreview({ outputFormat: 'png', verified: true, dispose() {} });
  await assert.rejects(session.assertExportable(), /IMAGE_PIXEL_REVIEW_REQUIRED/);
  session.confirmPixelReview(true);
  assert.equal((await session.assertExportable()).outputFormat, 'png');
  current = new Uint8Array([9]);
  await assert.rejects(session.assertExportable(), /IMAGE_SOURCE_CHANGED/);
});

test('clear disposes resources and stale generations cannot update state', async () => {
  let disposed = 0; const session = createImageSanitizeSession();
  await session.loadSource({ bytes, inspection, readAgain: async () => bytes, dispose() { disposed += 1; } });
  const generation = session.snapshot().generation;
  session.setPreview({ outputFormat: 'png', verified: true, dispose() { disposed += 1; } }, generation);
  session.clear();
  assert.equal(disposed, 2); assert.equal(session.snapshot().state, 'EMPTY');
  assert.throws(() => session.setPreview({ outputFormat: 'png', verified: true }, generation), /IMAGE_STALE_OPERATION/);
});

test('caps redactions and rejects empty rectangles', async () => {
  const session = createImageSanitizeSession({ maxRedactions: 2 }); await session.loadSource({ bytes, inspection, readAgain: async () => bytes });
  assert.throws(() => session.addRedaction({ x: 1, y: 1, width: 0, height: 2 }), /IMAGE_REDACTION_EMPTY/);
  session.addRedaction({ x: 0, y: 0, width: 1, height: 1 }); session.addRedaction({ x: 1, y: 1, width: 1, height: 1 });
  assert.throws(() => session.addRedaction({ x: 2, y: 2, width: 1, height: 1 }), /IMAGE_REDACTION_LIMIT/);
});

test('output option change invalidates preview without removing redactions', async () => {
  const session = createImageSanitizeSession(); await session.loadSource({ bytes, inspection, readAgain: async () => bytes });
  session.addRedaction({ x: 1, y: 1, width: 2, height: 2 }); session.setPreview({ outputFormat: 'png', verified: true }); session.confirmPixelReview(true);
  session.invalidatePreview();
  assert.equal(session.snapshot().redactions.length, 1); assert.equal(session.snapshot().reviewComplete, false); assert.equal(session.snapshot().state, 'EDITING_UNREVIEWED');
});
