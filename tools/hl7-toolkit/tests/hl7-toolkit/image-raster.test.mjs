import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeRaster } from '../../hl7-toolkit/app/scripts/image-raster.mjs';

test('freshly renders decoded pixels, flattens every rectangle and verifies reopened output', async () => {
  const calls = []; const encoded = new Uint8Array([9, 8, 7]);
  const adapter = {
    async decode(bytes, type) { calls.push(['decode', [...bytes], type]); return { width: 4, height: 3, privatePixels: true }; },
    async render(decoded, rectangles, options) { calls.push(['render', decoded.width, rectangles, options]); return { bytes: encoded, blob: { type: 'image/png' } }; },
    async verify(bytes, options) { calls.push(['verify', bytes, options]); return { width: 4, height: 3 }; },
    dispose(value) { calls.push(['dispose', value.width]); },
  };
  const result = await sanitizeRaster({ sourceBytes: new Uint8Array([1, 2]), inspection: { format: 'png', width: 4, height: 3 }, rectangles: [{ x: 0, y: 0, width: 2, height: 1 }, { x: 3, y: 2, width: 1, height: 1 }], outputFormat: 'png', adapter });
  assert.deepEqual([...result.bytes], [...encoded]); assert.equal(result.width, 4); assert.equal(result.height, 3);
  assert.deepEqual(calls[1][2], [{ x: 0, y: 0, width: 2, height: 1 }, { x: 3, y: 2, width: 1, height: 1 }]);
  assert.deepEqual(calls[2][2].rectangles, calls[1][2]); assert.equal(calls[2][2].fill, '#000000');
  assert.equal(calls.at(-1)[0], 'dispose'); assert.equal('rectangles' in result, false);
});

test('fails closed on decoded or verified dimension mismatch and disposes resources', async () => {
  let disposed = 0;
  const badDecode = { decode: async () => ({ width: 5, height: 3 }), dispose() { disposed += 1; } };
  await assert.rejects(sanitizeRaster({ sourceBytes: new Uint8Array(), inspection: { format: 'png', width: 4, height: 3 }, rectangles: [], outputFormat: 'png', adapter: badDecode }), /IMAGE_DECODE_DIMENSIONS_MISMATCH/);
  assert.equal(disposed, 1);
  const badVerify = { decode: async () => ({ width: 4, height: 3 }), render: async () => ({ bytes: new Uint8Array([1]), blob: {} }), verify: async () => ({ width: 3, height: 3 }), dispose() { disposed += 1; } };
  await assert.rejects(sanitizeRaster({ sourceBytes: new Uint8Array(), inspection: { format: 'png', width: 4, height: 3 }, rectangles: [], outputFormat: 'png', adapter: badVerify }), /IMAGE_OUTPUT_DIMENSIONS_MISMATCH/);
  assert.equal(disposed, 2);
});
