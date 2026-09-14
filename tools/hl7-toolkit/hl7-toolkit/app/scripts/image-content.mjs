import { createKnownValueIndex } from './known-values.mjs';
import { redactPatterns } from './residual-scan.mjs';

const MAX_LINES = 500;
const MAX_COLUMNS = 8;
const MAX_CHARS = 50000;
const LABEL = /^\s*([A-Za-z][A-Za-z0-9 /_-]{1,32})\s*[:=]\s*(.+?)\s*$/;
const BARE_LABEL = /^\s*(PATIENT NAME|PATIENT ID|MEDICAL RECORD NUMBER|MEDICAL RECORD|DATE OF BIRTH|BIRTH DATE|VISIT DATE|STUDY DATE|ACCOUNT NUMBER|ORDER NUMBER|ACCESSION NUMBER|PATIENT|PHYSICIAN|PROVIDER|DOCTOR|FACILITY|INSTITUTION|HOSPITAL|CLINIC|ACCESSION|ACCOUNT|ENCOUNTER|ADDRESS|TELEPHONE|CONTACT|PHONE|EMAIL|E-MAIL|ORDER|MRN|DOB)\s+(.+?)\s*$/i;
const PREFIX = { name: 'NAME', mrn: 'MRN', accession: 'ACCESSION', account: 'ACCOUNT', order: 'ORDER', date: 'DATE', contact: 'PHONE', email: 'EMAIL', address: 'ADDRESS', facility: 'FACILITY', 'national-id': 'IDENTIFIER', 'unique-id': 'IDENTIFIER', 'ip-address': 'IP', url: 'URL' };

function category(label) {
  const value = String(label).trim().toUpperCase();
  if (/^(?:PATIENT(?: NAME)?|NAME|PHYSICIAN|PROVIDER|DOCTOR)$/.test(value)) return 'name';
  if (/^(?:MRN|MEDICAL RECORD(?: NUMBER)?|PATIENT ID)$/.test(value)) return 'mrn';
  if (/^(?:ACCESSION|ACC(?:ESSION)?(?: NUMBER| ID)?)$/.test(value)) return 'accession';
  if (/^(?:ACCOUNT|ACCOUNT NUMBER|ENCOUNTER|ENCOUNTER ID)$/.test(value)) return 'account';
  if (/^(?:ORDER|ORDER ID|ORDER NUMBER)$/.test(value)) return 'order';
  if (/^(?:DOB|BIRTH DATE|DATE OF BIRTH|VISIT DATE|STUDY DATE|DATE)$/.test(value)) return 'date';
  if (/^(?:PHONE|TELEPHONE|CONTACT)$/.test(value)) return 'contact';
  if (value === 'EMAIL' || value === 'E-MAIL') return 'email';
  if (value === 'ADDRESS') return 'address';
  if (/^(?:FACILITY|INSTITUTION|HOSPITAL|CLINIC)$/.test(value)) return 'facility';
  return null;
}

function validBox(box) {
  return [box?.x0, box?.y0, box?.x1, box?.y1].every(Number.isFinite) && box.x1 > box.x0 && box.y1 > box.y0;
}

function splitCells(line) {
  const words = (Array.isArray(line.words) ? line.words : []).filter(word => validBox(word.bbox) && typeof word.text === 'string' && word.text.trim()).sort((a, b) => a.bbox.x0 - b.bbox.x0);
  if (words.length < 2) return null;
  const widths = words.map(word => (word.bbox.x1 - word.bbox.x0) / Math.max(1, word.text.length)).sort((a, b) => a - b);
  const threshold = Math.max(24, widths[Math.floor(widths.length / 2)] * 2.5);
  const groups = [[words[0]]];
  for (const word of words.slice(1)) {
    const previous = groups.at(-1).at(-1);
    if (word.bbox.x0 - previous.bbox.x1 > threshold) groups.push([]);
    groups.at(-1).push(word);
  }
  if (groups.length < 2 || groups.length > MAX_COLUMNS) return null;
  const joined = groups.flatMap(group => group.map(word => word.text)).join('').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
  const source = line.text.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
  if (joined !== source) return null;
  return groups.map(group => ({ x: group[0].bbox.x0, text: group.map(word => word.text.trim()).join(' ') }));
}

export function extractImageContent(regions) {
  const candidates = (Array.isArray(regions) ? regions : []).filter(region => validBox(region?.bbox) && String(region?.text ?? '').trim());
  if (candidates.length > MAX_LINES || candidates.some(region => String(region.text).trim().length > 1000)
    || candidates.reduce((total, region) => total + String(region.text).trim().length + 1, 0) > MAX_CHARS) throw new Error('IMAGE_CONTENT_LIMIT');
  const lines = candidates
    .sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0)
    .map(region => ({ text: String(region.text).trim(), bbox: { ...region.bbox }, words: Array.isArray(region.words) ? region.words : [] }));
  const text = lines.map(line => line.text).join('\n');
  const groups = lines.map(splitCells);
  const candidate = groups.length >= 3 && groups[0] && groups[0].filter(cell => category(cell.text)).length >= 2
    && groups.every(group => group && group.length === groups[0].length)
    && groups[0].every((cell, index) => groups.every(group => Math.abs(group[index].x - cell.x) <= 24));
  const table = candidate ? { status: 'READY', rows: groups.map(group => group.map(cell => cell.text.slice(0, 1000))) } : { status: 'UNCERTAIN', rows: [] };
  return { text, lines, table };
}

function calendarDate(value) {
  const compact = String(value).trim().replace(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/, (_, year, month, day) => `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`);
  let match = /^(\d{4})(\d{2})(\d{2})$/.exec(compact);
  if (!match) {
    const us = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(compact);
    if (us) match = [compact, us[3], us[1], us[2]];
  }
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.getTime() : null;
}

export function createImageContentSession() {
  let extracted = extractImageContent([]);
  let sanitized = null;
  let review = [];
  let maps = new Map();
  let counts = new Map();
  let known = createKnownValueIndex();
  let dateAnchor = null;
  const replace = (type, source) => {
    const value = String(source).trim();
    if (!value || /^(?:NAME|MRN|ACCESSION|PHONE|EMAIL|ADDRESS|ACCOUNT|ORDER|FACILITY|DATE|IDENTIFIER|REL-DAY)-?\d{4}$/i.test(value)) return value;
    const key = `${type}\0${value.toLowerCase()}`;
    if (maps.has(key)) return maps.get(key);
    let replacement;
    if (type === 'date') {
      const day = calendarDate(value);
      if (day !== null) {
        dateAnchor ??= day;
        const offset = Math.round((day - dateAnchor) / 86400000);
        replacement = `REL-DAY${offset >= 0 ? '+' : ''}${offset}`;
      }
    }
    if (!replacement) {
      const next = (counts.get(type) || 0) + 1;
      counts.set(type, next);
      replacement = `${PREFIX[type] || 'IDENTIFIER'}-${String(next).padStart(4, '0')}`;
    }
    maps.set(key, replacement);
    known.set(value, replacement);
    review.push({ category: type, source: value, replacement });
    return replacement;
  };
  const sanitizeLine = (line) => {
    const match = LABEL.exec(line) || BARE_LABEL.exec(line);
    if (match) {
      const type = category(match[1]);
      if (type) return `${match[1]}: ${replace(type, match[2])}`;
    }
    return redactPatterns(known.replace(line), replace);
  };
  return {
    load(regions) { extracted = extractImageContent([]); sanitized = null; review = []; maps.clear(); counts.clear(); known.clear(); dateAnchor = null; extracted = extractImageContent(regions); return extracted; },
    extracted: () => extracted,
    sanitized: () => sanitized,
    review: () => review.map(item => ({ ...item })),
    sanitize() {
      review = []; maps.clear(); counts.clear(); known.clear(); dateAnchor = null;
      const initialRows = extracted.table.status === 'READY' ? extracted.table.rows.map((row, rowIndex) => row.map((cell, columnIndex) => rowIndex === 0 ? cell : (category(extracted.table.rows[0][columnIndex]) ? replace(category(extracted.table.rows[0][columnIndex]), cell) : redactPatterns(known.replace(cell), replace)))) : [];
      const rows = initialRows.map(row => row.map(cell => known.replace(cell)));
      const text = extracted.table.status === 'READY' ? rows.map(row => row.join('  ')).join('\n') : extracted.lines.map(line => sanitizeLine(line.text)).join('\n');
      sanitized = { text: known.replace(text), table: { status: extracted.table.status, rows }, identifierCount: review.length };
      return sanitized;
    },
    clear() { extracted = extractImageContent([]); sanitized = null; review = []; maps.clear(); counts.clear(); known.clear(); dateAnchor = null; },
  };
}

export function sanitizedCsv(table) {
  if (table?.status !== 'READY') return '';
  return table.rows.map(row => row.map(value => {
    let cell = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(cell)) cell = `'${cell}`;
    return /[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
  }).join(',')).join('\r\n');
}
