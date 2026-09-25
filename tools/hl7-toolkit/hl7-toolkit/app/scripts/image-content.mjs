import { createKnownValueIndex } from './known-values.mjs';
import { redactPatterns } from './residual-scan.mjs';

const MAX_LINES = 500;
const MAX_COLUMNS = 16;
const MAX_CHARS = 50000;
const ALIASES = 'MEDICAL RECORD NUMBER|ACCESSION NUMBER|ACCOUNT NUMBER|ORDER NUMBER|PATIENT NAME|PATIENT ID|MEDICAL RECORD|DATE OF BIRTH|BIRTH DATE|VISIT DATE|STUDY DATE|PHYSICIAN|PROVIDER|FACILITY|INSTITUTION|HOSPITAL|CLINIC|ACCESSION|PATIENTID|PATIENT|ENCOUNTER|TELEPHONE|CONTACT|ADDRESS|ACCOUNT|ORDER|DOCTOR|PHONE|E-MAIL|EMAIL|NAME|MRN|DOB|ACC'
  .split('|').map(label => label.replaceAll(' ', '[\\s_-]+')).join('|');
const LABEL = /^(\s*([A-Za-z][A-Za-z0-9 /_-]{1,32})\s*[:=.]\s*)(.+?)\s*$/;
const BARE_LABEL = new RegExp(`^(\\s*(${ALIASES})\\s+)(.+?)\\s*$`, 'i');
const STANDALONE_LABEL = new RegExp(`^\\s*(${ALIASES})\\s*[:=.]?\\s*$`, 'i');
const CLINICAL_LABEL = /^(?:MODALITY|PROCEDURE|RESULT|FINDINGS|IMPRESSION|EXAM|DIAGNOSIS|REPORT|STATUS)\b/i;
const PREFIX = { name: 'NAME', mrn: 'MRN', accession: 'ACCESSION', account: 'ACCOUNT', order: 'ORDER', date: 'DATE', contact: 'PHONE', email: 'EMAIL', address: 'ADDRESS', facility: 'FACILITY', 'national-id': 'IDENTIFIER', 'unique-id': 'IDENTIFIER', 'ip-address': 'IP', url: 'URL' };
const US_DATE = /^(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:\d{2}|\d{4})$/;
const ISO_DATE = /^(?:19|20)\d{2}[-/](?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])$/;
const MODALITY = /^(?:PT|CT|MR|US|NM|XR|PET|CR|DX|MG|OT|RF|XA)$/i;
const DEPARTMENT = /^(?:IMAGING|RADIOLOGY|NUCLEAR|CARDIOLOGY|ULTRASOUND)$/i;
const ACCESSION_TOKEN = /^(?=.*\d)[A-Za-z0-9][A-Za-z0-9./-]{4,31}$/;

function category(label) {
  const value = String(label).trim().replace(/[:=.]+$/, '').replace(/[\s_-]+/g, ' ').toUpperCase();
  if (/^(?:PATIENT(?: NAME)?|NAME|PHYSICIAN|PROVIDER|DOCTOR)$/.test(value)) return 'name';
  if (/^(?:MRN|MEDICAL RECORD(?: NUMBER)?|PATIENT ID|PATIENTID)$/.test(value)) return 'mrn';
  if (/^(?:ACCESSION|ACC(?:ESSION)?(?: NUMBER| ID)?)$/.test(value)) return 'accession';
  if (/^(?:ACCOUNT|ACCOUNT NUMBER|ENCOUNTER|ENCOUNTER ID)$/.test(value)) return 'account';
  if (/^(?:ORDER|ORDER ID|ORDER NUMBER)$/.test(value)) return 'order';
  if (/^(?:DOB|BIRTH DATE|DATE OF BIRTH|VISIT DATE|STUDY DATE|DATE)$/.test(value)) return 'date';
  if (/^(?:PHONE|TELEPHONE|CONTACT)$/.test(value)) return 'contact';
  if (value === 'EMAIL' || value === 'E-MAIL') return 'email';
  if (value === 'ADDRESS') return 'address';
  if (/^(?:FACILITY|INSTITUTION|HOSPITAL|CLINIC|DEPARTMENT)$/.test(value)) return 'facility';
  return null;
}

function validBox(box) {
  return [box?.x0, box?.y0, box?.x1, box?.y1].every(Number.isFinite) && box.x1 > box.x0 && box.y1 > box.y0;
}

const CLINICAL_TERM = /^(?:TUMOR|IMAGE|IMAGING|PET|CT|MR|MRI|US|NM|XR|CR|DX|MG|RF|XA|PT|SKULL|BRAIN|CHEST|ABDOMEN|PELVIS|HEAD|NECK|SPINE|THORAX|CONTRAST|SCREENING|NUCLEAR|CARDIAC|BONE|LUNG|LIVER|KIDNEY|THYROID|WHOLE|BODY|SKULL-TH|W|WO|WITH|WITHOUT)$/i;

function isDateToken(value) {
  const text = String(value).trim();
  if (US_DATE.test(text) || ISO_DATE.test(text)) return calendarDate(text) !== null;
  if (/^\d{8}$/.test(text)) {
    const iso = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
    const mdy = `${text.slice(0, 2)}/${text.slice(2, 4)}/${text.slice(4, 8)}`;
    return calendarDate(iso) !== null || calendarDate(mdy) !== null;
  }
  return false;
}

function splitCells(line) {
  const words = (Array.isArray(line.words) ? line.words : []).filter(word => validBox(word.bbox) && typeof word.text === 'string' && word.text.trim()).sort((a, b) => a.bbox.x0 - b.bbox.x0);
  if (words.length < 2) return null;
  const widths = words.map(word => (word.bbox.x1 - word.bbox.x0) / Math.max(1, word.text.length)).sort((a, b) => a - b);
  const threshold = Math.max(16, widths[Math.floor(widths.length / 2)] * 1.8);
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

function splitWideGaps(line) {
  const words = (Array.isArray(line.words) ? line.words : []).filter(word => validBox(word.bbox) && String(word.text).trim());
  if (words.length < 3) return null;
  return splitCells({ ...line, words });
}

function isIdToken(token) {
  const text = String(token).trim();
  if (/^\d{5,12}$/.test(text)) return true;
  if (/^[A-Za-z]{1,4}\d{5,}$/.test(text)) return true;
  if (/^\d{3,}[-/]\d{2,}$/.test(text)) return true;
  return ACCESSION_TOKEN.test(text) && /\d{5,}/.test(text) && !/[ ,]/.test(text);
}

function explodeText(text) {
  const pieces = [];
  const source = String(text).replace(/\s+/g, ' ').trim();
  const re = /(\d{1,2}[/-]\d{1,2}[/-](?:\d{2}|\d{4}))|(\b(?:19|20)\d{2}[/-]\d{1,2}[/-]\d{1,2}\b)|(\b\d{8}\b)|(\b(?:IMAGING|RADIOLOGY|NUCLEAR|CARDIOLOGY|ULTRASOUND)\b)|(\b(?:PT|CT|MR|US|NM|XR|PET|CR|DX|MG)\b)|(\b[A-Za-z]{0,4}\d{5,12}[A-Za-z0-9-]*\b)|(\b\d{5,12}\b)|(\S+)/gi;
  let match;
  while ((match = re.exec(source))) {
    const token = match[0].trim();
    if (token) pieces.push(token);
  }
  return pieces;
}

function tokenizeRow(text) {
  const wide = String(text).split(/\s{2,}/).map(part => part.trim()).filter(Boolean);
  if (wide.length >= 4) return wide.flatMap(part => explodeText(part).length > 1 ? explodeText(part) : [part]);
  return explodeText(text);
}

function isNameToken(token) {
  const text = String(token).trim().replace(/,$/, '');
  if (!text || /\d/.test(text) || /[\\/]/.test(text)) return false;
  if (DEPARTMENT.test(text) || MODALITY.test(text) || CLINICAL_TERM.test(text)) return false;
  return /^[A-Za-z][A-Za-z'.-]*$/.test(text);
}

function tokenKind(token) {
  const text = String(token).trim();
  if (isDateToken(text)) return 'date';
  if (DEPARTMENT.test(text)) return 'dept';
  if (MODALITY.test(text) || CLINICAL_TERM.test(text)) return /^(?:PT|CT|MR|US|NM|XR|PET|CR|DX|MG|OT|RF|XA)$/i.test(text) ? 'mod' : 'clinical';
  if (isIdToken(text)) return 'id';
  if (isNameToken(text)) return 'name';
  return 'other';
}

function parseWorklistRow(text) {
  const tokens = tokenizeRow(text);
  if (tokens.length < 3) return null;
  const cells = [];
  let index = 0;
  while (index < tokens.length) {
    const kind = tokenKind(tokens[index]);
    if (kind === 'name') {
      const name = [];
      while (index < tokens.length && tokenKind(tokens[index]) === 'name' && name.length < 4) {
        name.push(tokens[index].replace(/,$/, name.length === 0 ? ',' : ''));
        index += 1;
      }
      cells.push(name.join(' ').replace(' ,', ','));
      continue;
    }
    cells.push(tokens[index]);
    index += 1;
  }
  if (cells.length < 3 || cells.length > MAX_COLUMNS) return null;
  if (!cells.some(cell => tokenKind(cell) === 'name' || isNameToken(cell.split(' ')[0] || ''))) return null;
  return cells.map(cell => cell.slice(0, 1000));
}

function inferHeaders(sample) {
  const used = { patient: false, dob: false, mrn: false, physician: false };
  return sample.map((cell, index) => {
    const kind = tokenKind(cell);
    if (kind === 'date' || isDateToken(cell)) {
      const year = Number(String(cell).replace(/\D/g, '').slice(-4));
      if (!used.dob && year >= 1920 && year <= 2012 && index > 0) {
        used.dob = true;
        return 'DOB';
      }
      return index === 0 ? 'STUDY DATE' : 'DATE';
    }
    if (kind === 'dept') return 'DEPARTMENT';
    if (kind === 'mod') return 'MODALITY';
    if (kind === 'clinical') return 'PROCEDURE';
    if (kind === 'id') {
      if (!used.mrn) {
        used.mrn = true;
        return 'MRN';
      }
      return 'ACCESSION';
    }
    if (kind === 'name' || isNameToken((cell.split(/\s+/)[0] || ''))) {
      if (!used.patient) {
        used.patient = true;
        return 'PATIENT';
      }
      if (!used.physician) {
        used.physician = true;
        return 'PHYSICIAN';
      }
      return 'NAME';
    }
    if (/[A-Za-z]{3,}/.test(cell) && /[ /]/.test(cell)) return 'PROCEDURE';
    return `COLUMN ${index + 1}`;
  });
}

function tableFromGeometry(lines) {
  const groups = lines.map(line => splitCells(line) || splitWideGaps(line));
  if (groups.length < 2) return null;
  const usable = groups.filter(Boolean);
  if (usable.length < 2) return null;
  const widthCounts = new Map();
  for (const group of usable) widthCounts.set(group.length, (widthCounts.get(group.length) || 0) + 1);
  const width = [...widthCounts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  if (width < 2 || width > MAX_COLUMNS) return null;
  const aligned = groups.map((group, index) => group && group.length === width ? group : null);
  const rows = [];
  const sources = [];
  for (let index = 0; index < aligned.length; index += 1) {
    if (!aligned[index]) continue;
    const first = rows[0];
    if (first && !aligned[index].every((cell, column) => Math.abs(cell.x - first[column].x) <= 48)) continue;
    rows.push(aligned[index]);
    sources.push(index);
  }
  if (rows.length < 2) return null;
  if (rows.length !== lines.length) return null;
  const headerLabels = rows[0].filter(cell => category(cell.text));
  const values = rows.map(row => row.map(cell => cell.text.slice(0, 1000)));
  if (headerLabels.length >= 2) return { status: 'READY', rows: values, reason: 'GEOMETRY' };
  const header = inferHeaders(values[0]);
  if (header.filter(cell => category(cell)).length < 2) return null;
  if (!values.some(row => row.some(isDateToken))) return null;
  return { status: 'READY', rows: [header, ...values], reason: 'GEOMETRY_INFERRED_HEADER' };
}

function tableFromWorklistText(lines) {
  const parsed = lines.map(line => parseWorklistRow(line.text)).filter(Boolean);
  if (parsed.length < 2) return null;
  const widthCounts = new Map();
  for (const row of parsed) widthCounts.set(row.length, (widthCounts.get(row.length) || 0) + 1);
  const width = [...widthCounts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  if (width < 3 || widthCounts.get(width) < 2) return null;
  const rows = parsed.filter(row => row.length === width);
  const header = inferHeaders(rows[0]);
  if (header.filter(cell => category(cell)).length < 2) return null;
  return { status: 'READY', rows: [header, ...rows], reason: 'WORKLIST_TEXT' };
}

export const SANITIZER_BUILD_ID = 'clinical-context-v3';
export const CONTENT_DIAGNOSTIC_BUILD_ID = 'worklist-text-v1';

function tableReconstruction(table) {
  const ready = table?.status === 'READY';
  const rows = ready ? table.rows.length : 0;
  const columns = ready && table.rows[0] ? table.rows[0].length : 0;
  return {
    TABLE_RECONSTRUCTION_INVOKED: true,
    TABLE_RECONSTRUCTION_RESULT: ready ? 'SUCCESS' : (table?.reason === 'MISSING_GEOMETRY' ? 'MISSING_GEOMETRY' : 'FAILED'),
    TABLE_RECONSTRUCTED_ROWS: rows,
    TABLE_RECONSTRUCTED_COLUMNS: columns,
    TABLE_RECONSTRUCTED_CELLS: rows * columns,
    TABLE_EMPTY_CELLS: 0,
    TABLE_AMBIGUOUS_CELLS: 0,
    TABLE_GEOMETRY_CERTIFICATION: ready ? 'ROW_CERTIFIED' : 'UNRESOLVED',
    RAW_CSV_AVAILABLE: ready,
    SANITIZED_CSV_AVAILABLE: ready,
  };
}

export function extractImageContent(regions) {
  const candidates = (Array.isArray(regions) ? regions : []).filter(region => validBox(region?.bbox) && String(region?.text ?? '').trim());
  if (candidates.length > MAX_LINES || candidates.some(region => String(region.text).trim().length > 1000)
    || candidates.reduce((total, region) => total + String(region.text).trim().length + 1, 0) > MAX_CHARS) throw new Error('IMAGE_CONTENT_LIMIT');
  const lines = candidates
    .sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0)
    .map(region => ({ text: String(region.text).trim(), bbox: { ...region.bbox }, words: Array.isArray(region.words) ? region.words : [] }));
  const text = lines.map(line => line.text).join('\n');
  const table = tableFromGeometry(lines) || tableFromWorklistText(lines) || { status: 'UNCERTAIN', rows: [], reason: 'MISSING_GEOMETRY' };
  const reconstruction = tableReconstruction(table);
  return { text, lines, table, reconstructedTable: table, tableReconstruction: reconstruction };
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

function emptyDiagnostics(extra = {}) {
  return {
    sanitizerBuildId: SANITIZER_BUILD_ID,
    sanitizeInvoked: false,
    headerScanInvoked: false,
    classifierInvoked: false,
    normalizedLines: 0,
    ocrLines: 0,
    labelsDetected: 0,
    identifiersClassified: 0,
    nameReplacements: 0,
    mrnReplacements: 0,
    accessionReplacements: 0,
    orderReplacements: 0,
    dateReplacements: 0,
    providerReplacements: 0,
    ambiguousDates: 0,
    headerFieldsDetected: 0,
    sensitiveColumnsDetected: 0,
    rowsClassified: 0,
    unresolvedSensitiveCells: 0,
    unresolvedLabels: 0,
    sanitizedLines: 0,
    REJECTED_ROW_COUNT: 0,
    UNKNOWN_COLUMNS_CLASSIFIED: 0,
    UNKNOWN_COLUMN_CELLS_REDACTED: 0,
    POSITIONED_HEADER: false,
    HEADER_SOURCE: 'UNKNOWN',
    TABLE_RECONSTRUCTION_INVOKED: false,
    TABLE_RECONSTRUCTION_RESULT: 'FAILED',
    TABLE_RECONSTRUCTED_ROWS: 0,
    TABLE_RECONSTRUCTED_COLUMNS: 0,
    TABLE_RECONSTRUCTED_CELLS: 0,
    TABLE_EMPTY_CELLS: 0,
    TABLE_AMBIGUOUS_CELLS: 0,
    TABLE_GEOMETRY_CERTIFICATION: 'UNRESOLVED',
    RAW_CSV_AVAILABLE: false,
    SANITIZED_CSV_AVAILABLE: false,
    ...extra,
  };
}

export function createImageContentSession() {
  let extracted = extractImageContent([]);
  let sanitized = null;
  let review = [];
  let maps = new Map();
  let counts = new Map();
  let known = createKnownValueIndex();
  let dateAnchor = null;
  let phases = emptyDiagnostics();
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
    if (STANDALONE_LABEL.test(line)) return line;
    const match = LABEL.exec(line) || BARE_LABEL.exec(line);
    if (match) {
      const type = category(match[2]);
      if (type) return `${match[1]}${replace(type, match[3])}`;
    }
    return redactPatterns(known.replace(line), replace);
  };
  const pairedValue = (label, value, type) => {
    const first = label.bbox; const second = value.bbox;
    const gap = second.y0 - first.y1;
    const height = first.y1 - first.y0;
    const nextRow = gap >= -2 && gap <= Math.max(35, height * 1.5) && Math.abs(second.x0 - first.x0) <= 60;
    const sameRow = Math.abs((second.y0 + second.y1 - first.y0 - first.y1) / 2) <= height * 0.6
      && second.x0 >= first.x1 && second.x0 - first.x1 <= Math.max(100, height * 5);
    if (!nextRow && !sameRow) return false;
    const text = value.text.trim();
    if (STANDALONE_LABEL.test(text) || LABEL.test(text) || BARE_LABEL.test(text) || CLINICAL_LABEL.test(text) || /[:=]/.test(text)) return false;
    if (type === 'name') return /^(?:[A-Z][A-Za-z'’]*)(?:[ ,^-]+[A-Z][A-Za-z'’]*){1,4}$/.test(text);
    if (type === 'mrn' || type === 'accession' || type === 'account' || type === 'order') return /^[A-Za-z0-9][A-Za-z0-9./-]{1,63}$/.test(text);
    if (type === 'date') return calendarDate(text) !== null;
    return false;
  };
  return {
    load(regions) {
      extracted = extractImageContent([]); sanitized = null; review = []; maps.clear(); counts.clear(); known.clear(); dateAnchor = null;
      extracted = extractImageContent(regions);
      phases = emptyDiagnostics({
        normalizedLines: extracted.lines.length,
        ocrLines: extracted.lines.length,
        headerScanInvoked: true,
        classifierInvoked: true,
        ...extracted.tableReconstruction,
      });
      return extracted;
    },
    extracted: () => extracted,
    sanitized: () => sanitized,
    review: () => review.map(item => ({ ...item })),
    diagnostics: () => ({ ...phases }),
    pipelineDiagnostic: () => ({ extracted, sanitized, phases }),
    sanitize() {
      review = []; maps.clear(); counts.clear(); known.clear(); dateAnchor = null;
      const initialRows = extracted.table.status === 'READY' ? extracted.table.rows.map((row, rowIndex) => row.map((cell, columnIndex) => rowIndex === 0 ? cell : (category(extracted.table.rows[0][columnIndex]) ? replace(category(extracted.table.rows[0][columnIndex]), cell) : redactPatterns(known.replace(cell), replace)))) : [];
      const rows = initialRows.map(row => row.map(cell => known.replace(cell)));
      const text = extracted.table.status === 'READY' ? rows.map(row => row.join('  ')).join('\n') : (() => {
        const output = [];
        for (let index = 0; index < extracted.lines.length; index += 1) {
          const line = extracted.lines[index]; const type = category(STANDALONE_LABEL.exec(line.text)?.[1]);
          const next = extracted.lines[index + 1];
          if (type && next && pairedValue(line, next, type)) {
            output.push(line.text, replace(type, next.text)); index += 1;
          } else output.push(sanitizeLine(line.text));
        }
        return output.join('\n');
      })();
      const reconstruction = tableReconstruction(extracted.table);
      const diagnostics = emptyDiagnostics({
        sanitizeInvoked: true,
        headerScanInvoked: true,
        classifierInvoked: true,
        normalizedLines: extracted.lines.length,
        ocrLines: extracted.lines.length,
        identifiersClassified: review.length,
        nameReplacements: review.filter(item => item.category === 'name').length,
        mrnReplacements: review.filter(item => item.category === 'mrn').length,
        accessionReplacements: review.filter(item => item.category === 'accession').length,
        orderReplacements: review.filter(item => item.category === 'order').length,
        dateReplacements: review.filter(item => item.category === 'date').length,
        providerReplacements: review.filter(item => item.category === 'name' && /PHYSICIAN|PROVIDER|DOCTOR/.test(String(extracted.table.rows[0]?.[extracted.table.rows[0]?.indexOf?.()]))).length,
        headerFieldsDetected: extracted.table.status === 'READY' ? extracted.table.rows[0].filter(cell => category(cell)).length : 0,
        sensitiveColumnsDetected: extracted.table.status === 'READY' ? extracted.table.rows[0].filter(cell => category(cell)).length : 0,
        rowsClassified: extracted.table.status === 'READY' ? Math.max(0, extracted.table.rows.length - 1) : 0,
        sanitizedLines: extracted.table.status === 'READY' ? rows.length : extracted.lines.length,
        POSITIONED_HEADER: extracted.table.status === 'READY',
        HEADER_SOURCE: extracted.table.reason === 'GEOMETRY' ? 'POSITIONAL' : extracted.table.status === 'READY' ? 'ALIAS_FALLBACK' : 'UNKNOWN',
        SANITIZED_CSV_AVAILABLE: extracted.table.status === 'READY',
        ...reconstruction,
      });
      phases = diagnostics;
      sanitized = {
        text: known.replace(text),
        table: { status: extracted.table.status, rows, reason: extracted.table.reason },
        identifierCount: review.length,
        complete: true,
        diagnostics,
      };
      return sanitized;
    },
    clear() { extracted = extractImageContent([]); sanitized = null; review = []; maps.clear(); counts.clear(); known.clear(); dateAnchor = null; phases = emptyDiagnostics(); },
  };
}

function csvRows(table, delimiter) {
  if (table?.status !== 'READY') return '';
  return table.rows.map(row => row.map(value => {
    let cell = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(cell)) cell = `'${cell}`;
    const special = delimiter === ',' ? /[",\r\n]/ : /["\t\r\n]/;
    return special.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
  }).join(delimiter)).join('\r\n');
}

export function sanitizedCsv(table) { return csvRows(table, ','); }
export function rawCsv(table) { return csvRows(table, ','); }
export function sanitizedTsv(table) { return csvRows(table, '\t'); }
