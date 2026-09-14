const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_SIDE = 16_384;
const MAX_PIXELS = 40_000_000;
const PNG_FORBIDDEN = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt']);
const PNG_ALLOWED_OUTPUT = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB']);

const failure = code => { throw new Error(code); };
const starts = (bytes, values, offset = 0) => values.every((value, index) => bytes[offset + index] === value);
const textAt = (bytes, offset, length) => String.fromCharCode(...bytes.subarray(offset, offset + length));
const u16 = (bytes, offset) => (bytes[offset] << 8) | bytes[offset + 1];
const u32 = (bytes, offset) => ((bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]);
function dimensions(width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) failure('IMAGE_MALFORMED');
  if (width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_PIXELS) failure('IMAGE_DIMENSIONS_EXCEEDED');
}
function category(categories, value) { if (!categories.includes(value)) categories.push(value); }

function inspectPng(bytes, verify = false) {
  let offset = 8; let width = 0; let height = 0; let count = 0; let ended = false; const categories = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) failure('IMAGE_MALFORMED');
    const length = u32(bytes, offset); const type = textAt(bytes, offset + 4, 4); const end = offset + 12 + length;
    if (!Number.isSafeInteger(end) || end > bytes.length) failure('IMAGE_MALFORMED');
    if (offset === 8 && type !== 'IHDR') failure('IMAGE_MALFORMED');
    if (type === 'IHDR') {
      if (length !== 13 || width) failure('IMAGE_MALFORMED');
      width = u32(bytes, offset + 8); height = u32(bytes, offset + 12); dimensions(width, height);
    }
    let found = null;
    if (type === 'eXIf') found = 'EXIF';
    else if (['tEXt', 'zTXt', 'iTXt'].includes(type)) found = 'text';
    else if ((type.charCodeAt(0) & 32) !== 0 && !PNG_ALLOWED_OUTPUT.has(type)) found = 'other ancillary metadata';
    if (found) { category(categories, found); count += 1; }
    if (verify && !PNG_ALLOWED_OUTPUT.has(type)) failure('IMAGE_OUTPUT_METADATA_FORBIDDEN');
    offset = end;
    if (type === 'IEND') { if (length !== 0) failure('IMAGE_MALFORMED'); ended = true; break; }
  }
  if (!ended || !width) failure('IMAGE_MALFORMED');
  if (offset !== bytes.length) failure('IMAGE_TRAILING_PAYLOAD');
  return { format: 'png', width, height, metadata: { status: count ? 'present' : 'absent', categories, count } };
}

const isSof = marker => marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
function inspectJpeg(bytes, verify = false) {
  let offset = 2; let width = 0; let height = 0; let ended = false; let inScan = false; let count = 0; const categories = []; const iccParts = new Set(); let iccTotal = 0;
  while (offset < bytes.length) {
    if (inScan) {
      while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
      if (offset >= bytes.length) failure('IMAGE_MALFORMED');
      while (bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset++];
      if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (marker === 0xd9) { ended = true; break; }
      inScan = false; offset -= 2;
    }
    if (bytes[offset++] !== 0xff) failure('IMAGE_MALFORMED');
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9) { ended = true; break; }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
    if (offset + 2 > bytes.length) failure('IMAGE_MALFORMED');
    const segmentLength = u16(bytes, offset); if (segmentLength < 2 || offset + segmentLength > bytes.length) failure('IMAGE_MALFORMED');
    const payloadOffset = offset + 2; const payloadLength = segmentLength - 2;
    if (isSof(marker)) {
      if (payloadLength < 5) failure('IMAGE_MALFORMED');
      height = u16(bytes, payloadOffset + 1); width = u16(bytes, payloadOffset + 3); dimensions(width, height);
    }
    const icc = marker === 0xe2 && payloadLength >= 14 && starts(bytes, [73,67,67,95,80,82,79,70,73,76,69,0], payloadOffset);
    if (icc) { const part = bytes[payloadOffset + 12]; const total = bytes[payloadOffset + 13]; if (!part || !total || part > total || (iccTotal && total !== iccTotal) || iccParts.has(part)) failure('IMAGE_OUTPUT_METADATA_FORBIDDEN'); iccTotal = total; iccParts.add(part); }
    let found = null;
    if (marker === 0xe1 && starts(bytes, [69,120,105,102,0,0], payloadOffset)) found = 'EXIF';
    else if (marker === 0xe1) found = 'XMP';
    else if (marker === 0xed) found = 'IPTC/Photoshop';
    else if (marker === 0xfe) found = 'comment';
    else if (marker >= 0xe0 && marker <= 0xef && !(marker === 0xe0 && starts(bytes, [74,70,73,70,0], payloadOffset))) found = 'other application metadata';
    if (found) { category(categories, found); count += 1; }
    if (verify && ((found && !icc) || (marker >= 0xe0 && marker <= 0xef && marker !== 0xe0 && !icc))) failure('IMAGE_OUTPUT_METADATA_FORBIDDEN');
    offset += segmentLength;
    if (marker === 0xda) inScan = true;
  }
  if (!ended || !width) failure('IMAGE_MALFORMED');
  if (verify && iccTotal && iccParts.size !== iccTotal) failure('IMAGE_OUTPUT_METADATA_FORBIDDEN');
  if (offset !== bytes.length) failure('IMAGE_TRAILING_PAYLOAD');
  return { format: 'jpeg', width, height, metadata: { status: count ? 'present' : 'absent', categories, count } };
}

export function inspectImageBytes(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length > MAX_BYTES) failure('IMAGE_FILE_TOO_LARGE');
  if (bytes.length >= 132 && textAt(bytes, 128, 4) === 'DICM') failure('IMAGE_DICOM_UNSUPPORTED');
  if (starts(bytes, PNG_SIGNATURE)) return inspectPng(bytes);
  if (starts(bytes, [0xff, 0xd8])) return inspectJpeg(bytes);
  failure('IMAGE_FORMAT_UNSUPPORTED');
}

export function verifySanitizedImageBytes(input, expectedFormat) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let inspected;
  if (starts(bytes, PNG_SIGNATURE)) inspected = inspectPng(bytes, true);
  else if (starts(bytes, [0xff, 0xd8])) inspected = inspectJpeg(bytes, true);
  else failure('IMAGE_FORMAT_UNSUPPORTED');
  if (inspected.format !== expectedFormat) failure('IMAGE_OUTPUT_FORMAT_MISMATCH');
  return { format: inspected.format, width: inspected.width, height: inspected.height };
}
