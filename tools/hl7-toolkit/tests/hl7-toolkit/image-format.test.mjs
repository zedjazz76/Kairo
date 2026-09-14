import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectImageBytes, verifySanitizedImageBytes } from '../../hl7-toolkit/app/scripts/image-format.mjs';

const ascii = value => [...Buffer.from(value, 'ascii')];
const u32 = value => [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
const pngChunk = (type, payload = []) => new Uint8Array([...u32(payload.length), ...ascii(type), ...payload, 0, 0, 0, 0]);
const png = (...chunks) => new Uint8Array([137,80,78,71,13,10,26,10, ...pngChunk('IHDR', [...u32(4), ...u32(3), 8, 6, 0, 0, 0]), ...chunks.flatMap(v => [...v]), ...pngChunk('IEND')]);
const jpegSegment = (marker, payload = []) => new Uint8Array([255, marker, ((payload.length + 2) >>> 8) & 255, (payload.length + 2) & 255, ...payload]);
const jpeg = (...segments) => new Uint8Array([255,216, ...segments.flatMap(v => [...v]), ...jpegSegment(0xc0, [8,0,3,0,4,1,1,0]), 255,217]);

test('inspects PNG dimensions and metadata containers without values', () => {
  const result = inspectImageBytes(png(pngChunk('eXIf', ascii('SECRET-NAME')), pngChunk('iTXt', ascii('SECRET-NOTE'))));
  assert.deepEqual(result, { format: 'png', width: 4, height: 3, metadata: { status: 'present', categories: ['EXIF', 'text'], count: 2 } });
  assert.doesNotMatch(JSON.stringify(result), /SECRET/);
});

test('inspects JPEG dimensions and metadata categories without values', () => {
  const result = inspectImageBytes(jpeg(jpegSegment(0xe1, ascii('Exif\0\0SECRET')), jpegSegment(0xed, ascii('Photoshop 3.0\0SECRET')), jpegSegment(0xfe, ascii('SECRET'))));
  assert.deepEqual(result, { format: 'jpeg', width: 4, height: 3, metadata: { status: 'present', categories: ['EXIF', 'IPTC/Photoshop', 'comment'], count: 3 } });
  assert.doesNotMatch(JSON.stringify(result), /SECRET/);
});

test('reports absent metadata and verifies clean allowlisted encodings', () => {
  assert.equal(inspectImageBytes(png()).metadata.status, 'absent');
  assert.deepEqual(verifySanitizedImageBytes(png(), 'png'), { format: 'png', width: 4, height: 3 });
  assert.deepEqual(verifySanitizedImageBytes(jpeg(), 'jpeg'), { format: 'jpeg', width: 4, height: 3 });
});

test('sanitized verifier rejects forbidden metadata and trailing payload', () => {
  assert.throws(() => verifySanitizedImageBytes(png(pngChunk('tEXt', ascii('key\0value'))), 'png'), /IMAGE_OUTPUT_METADATA_FORBIDDEN/);
  assert.throws(() => verifySanitizedImageBytes(jpeg(jpegSegment(0xe2, ascii('payload'))), 'jpeg'), /IMAGE_OUTPUT_METADATA_FORBIDDEN/);
  assert.throws(() => verifySanitizedImageBytes(new Uint8Array([...png(), 1]), 'png'), /IMAGE_TRAILING_PAYLOAD/);
});

test('sanitized JPEG permits only the encoder-created ICC profile APP2 shape', () => {
  const icc = jpegSegment(0xe2, [...ascii('ICC_PROFILE\0'), 1, 1, 0, 1, 2, 3]);
  assert.deepEqual(verifySanitizedImageBytes(jpeg(icc), 'jpeg'), { format: 'jpeg', width: 4, height: 3 });
  assert.throws(() => verifySanitizedImageBytes(jpeg(jpegSegment(0xe2, ascii('ARBITRARY'))), 'jpeg'), /IMAGE_OUTPUT_METADATA_FORBIDDEN/);
});

test('rejects DICOM, unsupported, malformed and excessive images with stable codes', () => {
  const dicom = new Uint8Array(132); dicom.set(ascii('DICM'), 128);
  assert.throws(() => inspectImageBytes(dicom), /IMAGE_DICOM_UNSUPPORTED/);
  assert.throws(() => inspectImageBytes(new Uint8Array(ascii('GIF89a'))), /IMAGE_FORMAT_UNSUPPORTED/);
  assert.throws(() => inspectImageBytes(new Uint8Array([137,80,78,71,13,10,26,10,0,0,255,255])), /IMAGE_MALFORMED/);
  assert.throws(() => inspectImageBytes(png(pngChunk('IHDR', [...u32(20000), ...u32(3), 8, 6, 0, 0, 0]))), /IMAGE_MALFORMED|IMAGE_DIMENSIONS_EXCEEDED/);
});

test('rejects format mismatch', () => {
  assert.throws(() => verifySanitizedImageBytes(png(), 'jpeg'), /IMAGE_OUTPUT_FORMAT_MISMATCH/);
});
