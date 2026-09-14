import { verifySanitizedImageBytes } from './image-format.mjs';

const fail = code => { throw new Error(code); };
const mime = format => format === 'png' ? 'image/png' : 'image/jpeg';

export async function sanitizeRaster({ sourceBytes, inspection, rectangles, outputFormat, adapter }) {
  let decoded;
  try {
    decoded = await adapter.decode(sourceBytes, inspection.format);
    if (decoded.width !== inspection.width || decoded.height !== inspection.height) fail('IMAGE_DECODE_DIMENSIONS_MISMATCH');
    const options = { format: outputFormat, quality: outputFormat === 'jpeg' ? 0.92 : undefined, background: '#ffffff', fill: '#000000' };
    const rendered = await adapter.render(decoded, rectangles.map(value => ({ ...value })), options);
    const bytes = rendered.bytes instanceof Uint8Array ? rendered.bytes : new Uint8Array(rendered.bytes);
    const verified = await adapter.verify(bytes, { format: outputFormat, width: inspection.width, height: inspection.height, rectangles: rectangles.map(value => ({ ...value })), fill: options.fill });
    if (verified.width !== inspection.width || verified.height !== inspection.height) fail('IMAGE_OUTPUT_DIMENSIONS_MISMATCH');
    return { bytes, blob: rendered.blob, width: verified.width, height: verified.height };
  } finally { if (decoded) adapter.dispose(decoded); }
}

export function createBrowserRasterAdapter(environment = globalThis) {
  const makeCanvas = (width, height) => {
    const canvas = environment.document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas;
  };
  const blobFrom = (bytes, format) => new environment.Blob([bytes], { type: mime(format) });
  const encode = (canvas, format, quality) => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('IMAGE_ENCODE_FAILED')), mime(format), quality));
  return {
    async decode(bytes, format) { return environment.createImageBitmap(blobFrom(bytes, format), { imageOrientation: 'from-image' }); },
    async render(decoded, rectangles, { format, quality, background, fill }) {
      const canvas = makeCanvas(decoded.width, decoded.height); const context = canvas.getContext('2d', { alpha: format === 'png' });
      if (!context) fail('IMAGE_CANVAS_UNAVAILABLE');
      if (format === 'jpeg') { context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height); }
      context.drawImage(decoded, 0, 0); context.fillStyle = fill;
      for (const rectangle of rectangles) context.fillRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
      const blob = await encode(canvas, format, quality); const bytes = new Uint8Array(await blob.arrayBuffer());
      canvas.width = 0; canvas.height = 0; return { bytes, blob };
    },
    async verify(bytes, { format, width, height, rectangles }) {
      const structural = verifySanitizedImageBytes(bytes, format);
      const decoded = await environment.createImageBitmap(blobFrom(bytes, format));
      try {
        if (decoded.width !== width || decoded.height !== height) fail('IMAGE_OUTPUT_DIMENSIONS_MISMATCH');
        const canvas = makeCanvas(width, height); const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) fail('IMAGE_CANVAS_UNAVAILABLE'); context.drawImage(decoded, 0, 0);
        const tolerance = format === 'jpeg' ? 24 : 0;
        for (const rectangle of rectangles) {
          const x = Math.min(width - 1, rectangle.x + Math.floor((rectangle.width - 1) / 2));
          const y = Math.min(height - 1, rectangle.y + Math.floor((rectangle.height - 1) / 2));
          const pixel = context.getImageData(x, y, 1, 1).data;
          if (pixel[0] > tolerance || pixel[1] > tolerance || pixel[2] > tolerance || pixel[3] !== 255) fail('IMAGE_REDACTION_VERIFICATION_FAILED');
        }
        canvas.width = 0; canvas.height = 0; return structural;
      } finally { decoded.close?.(); }
    },
    dispose(value) { value?.close?.(); },
  };
}
