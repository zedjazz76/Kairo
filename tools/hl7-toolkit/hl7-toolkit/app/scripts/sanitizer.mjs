import { cloneParsedMessage, parseHl7, serializeHl7 } from './hl7-parser.mjs';
import { redactPatterns, scanResidual } from './residual-scan.mjs';
import { createKnownValueIndex } from './known-values.mjs';

const PREFIXES = {
  name: 'NAME', mrn: 'MRN', account: 'ACCOUNT', encounter: 'ENCOUNTER', order: 'ORDER',
  accession: 'ACCESSION', insurance: 'INSURANCE', 'national-id': 'NATIONAL-ID', address: 'ADDRESS',
  contact: 'PHONE', email: 'EMAIL', date: 'DATE', url: 'URL', 'ip-address': 'IP',
  'unique-id': 'IDENTIFIER', control: 'CONTROL', specimen: 'SPECIMEN', attachment: 'REMOVED-ATTACHMENT',
};

function formatReplacement(category, number) {
  return `${PREFIXES[category] || 'REDACTED'}-${String(number).padStart(4, '0')}`;
}

function calendarParts(value) {
  const compact = value.replace(/^(\d{4})[-/](\d{2})[-/](\d{2})/, '$1$2$3');
  const match = /^(\d{4})(\d{2})(\d{2})(.*)$/.exec(compact);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() + 1 !== Number(match[2]) || date.getUTCDate() !== Number(match[3])) return null;
  return { date, suffix: match[4] };
}

function joinField(repetitions, delimiters) {
  return repetitions.map((repetition) => repetition.map((component) => component.join(delimiters.subcomponent)).join(delimiters.component)).join(delimiters.repetition);
}

function reviewWarning(code, path, summary) {
  return { id: `${code}:${path}`, code, path, confidence: 'coverage', summary };
}

function sanitizeParsedMessage(message, context) {
  const { rules, mode, replace, replaceKnown, knownMatches, ruleMap, providerPaths, freeTextPaths } = context;
  const replacements = [];
  const warnings = [];
  const output = cloneParsedMessage(message);
  const unknownSegments = [];

  function replacement(category, value, path) {
    if (!value || value === '""') return value;
    const result = replace(category, value, mode);
    if (result !== value) replacements.push({ path, category, replacement: result });
    return result;
  }

  if (message.malformed) {
    let text = message.source;
    const labels = [
      ['name', /\b(?:patient(?: name)?|name)\s*[:=]\s*([^\r\n;,]+)/gi],
      ['mrn', /\b(?:MRN|medical record(?: number)?)\s*[:=#]\s*([^\s;,]+)/gi],
      ['account', /\b(?:account|encounter|accession|policy|beneficiary|member)(?:\s*(?:ID|number|no\.?))?\s*[:=#]\s*([^\s;,]+)/gi],
      ['unique-id', /\b(?:device|certificate|license|vehicle|biometric|serial)(?:\s*(?:ID|number|no\.?))?\s*[:=#]\s*([^\r\n;,]+)/gi],
    ];
    for (const [category, pattern] of labels) {
      text = text.replace(pattern, (whole, value) => whole.slice(0, whole.length - value.length) + replacement(category, value, 'text'));
    }
    text = replaceKnown(text);
    text = redactPatterns(text, (category, value) => replacement(category, value, 'text'));
    warnings.push(reviewWarning('UNSTRUCTURED_TEXT_REVIEW', 'text', 'Unstructured text can contain names and context that pattern matching cannot identify. Review every line before copying.'));
    warnings.push(...scanResidual(text, { knownMatches: knownMatches(text), skipDates: mode === 'synthetic-test' }));
    return {
      text, replacements, warnings,
      coverage: { categories: rules.categories, unknownSegments: [], providerPolicy: 'preserved', unstructured: true },
      policyVersion: rules.version, mode,
    };
  }

  for (const segment of output.segments) {
    for (let index = 1; index < segment.fields.length; index += 1) {
      const path = `${segment.name}-${index}`;
      let rule = ruleMap.get(path);
      if (path === 'OBX-5') {
        const type = segment.fields[2]?.raw;
        if (['PN', 'XPN'].includes(type)) rule = { category: 'name', components: [1, 2, 3, 4, 5, 6] };
        if (['AD', 'XAD'].includes(type)) rule = { category: 'address', components: [1, 2, 3, 5, 8, 9, 10, 12, 13] };
        if (['TN', 'XTN'].includes(type)) rule = { category: 'contact', all: true };
        if (['CX', 'EI'].includes(type)) rule = { category: 'unique-id', components: [1] };
        if (['DT', 'TS', 'DTM'].includes(type)) rule = { category: 'date', components: [1] };
        if (['ED', 'RP'].includes(type)) {
          rule = { category: 'attachment', all: true };
          warnings.push(reviewWarning('EMBEDDED_CONTENT_REMOVED', path, 'Embedded content or a document reference was removed because its internal PHI cannot be safely inspected here.'));
        }
      }
      if (!rule || providerPaths.has(path)) continue;
      const field = segment.fields[index];
      field.repetitions = field.repetitions.map((repetition) => repetition.map((component, componentIndex) =>
        rule.all || rule.components.includes(componentIndex + 1)
          ? component.map((value) => replacement(rule.category, value, path))
          : component));
      field.raw = joinField(field.repetitions, output.delimiters);
    }
  }

  for (const segment of output.segments) {
    if (segment.name && !rules.knownSegments.includes(segment.name)) {
      unknownSegments.push(segment.name);
      warnings.push(reviewWarning('UNKNOWN_SEGMENT_REVIEW', segment.name, 'This segment has no reviewed PHI definition. Inspect all remaining values.'));
    }
    for (let index = 1; index < segment.fields.length; index += 1) {
      const path = `${segment.name}-${index}`;
      const field = segment.fields[index];
      if (field.literal || providerPaths.has(path)) continue;
      const knownReplaced = replaceKnown(field.raw);
      const text = redactPatterns(knownReplaced, (category, value) => replacement(category, value, path), { skipDates: mode === 'synthetic-test' });
      field.raw = text;
      if (freeTextPaths.has(path) && text) {
        if (path !== 'OBX-5' || ['TX', 'FT', 'ST', 'XPN', 'PN', 'XAD', 'AD'].includes(segment.fields[2]?.raw)) {
          warnings.push(reviewWarning('FREE_TEXT_REVIEW', path, 'Review narrative content for names, unique details, and identifiers not represented in structured fields.'));
        }
      }
      warnings.push(...scanResidual(text, { knownMatches: knownMatches(text), path, skipDates: mode === 'synthetic-test' }));
    }
  }
  if (mode === 'synthetic-test') {
    warnings.push(reviewWarning('SYNTHETIC_NOT_DEIDENTIFIED', 'message', 'Shifted dates are synthetic test data, not a de-identification determination.'));
  }
  output.edited = true;
  return {
    text: serializeHl7(output), replacements,
    warnings: [...new Map(warnings.map((warning) => [warning.id, warning])).values()],
    coverage: { categories: rules.categories, unknownSegments: [...new Set(unknownSegments)], providerPolicy: 'preserved', unstructured: false },
    policyVersion: rules.version, mode,
  };
}

export function createSanitizerSession(rules, { dateShiftDays } = {}) {
  const maps = new Map();
  const sequence = new Map();
  const known = createKnownValueIndex();
  const ruleMap = new Map(rules.rules.flatMap((rule) => rule.paths.map((path) => [path, rule])));
  const providerPaths = new Set(rules.providerPreservedPaths);
  const freeTextPaths = new Set(rules.freeTextPaths);
  let dateAnchor = null;
  const shift = dateShiftDays ?? -(3650 + Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 * 10950));

  function token(category, value) {
    const key = category + '\u0000' + value;
    if (maps.has(key)) return maps.get(key);
    const next = (sequence.get(category) || 0) + 1;
    sequence.set(category, next);
    const result = formatReplacement(category, next);
    maps.set(key, result);
    return result;
  }

  function replace(category, value, mode) {
    let result;
    if (category === 'date') {
      const parts = calendarParts(value);
      if (parts) {
        if (dateAnchor === null) dateAnchor = parts.date.getTime();
        if (mode === 'synthetic-test') {
          const shifted = new Date(parts.date.getTime() + shift * 86400000);
          result = shifted.toISOString().slice(0, 10).replaceAll('-', '') + parts.suffix;
        } else {
          const days = Math.round((parts.date.getTime() - dateAnchor) / 86400000);
          result = `REL-DAY${days >= 0 ? '+' : ''}${days}`;
        }
      } else {
        result = token(category, value);
      }
    } else {
      result = token(category, value);
    }
    if (value.length >= 3) known.set(value, result);
    return result;
  }

  const knownMatches = (text) => known.matches(text, { boundaries: false });

  return {
    sanitize(message, mode = 'chat-safe') {
      if (!['chat-safe', 'synthetic-test'].includes(mode)) throw new TypeError('Unknown sanitization mode');
      return sanitizeParsedMessage(typeof message === 'string' ? parseHl7(message) : message, {
        rules, mode, replace, replaceKnown: known.replace, knownMatches, ruleMap, providerPaths, freeTextPaths,
      });
    },
    scan(text, mode = 'chat-safe') {
      const message = parseHl7(text);
      if (message.malformed) return scanResidual(text, { knownMatches: knownMatches(text), skipDates: mode === 'synthetic-test' });
      const warnings = [];
      for (const segment of message.segments) {
        segment.fields.forEach((field, index) => {
          const path = `${segment.name}-${index}`;
          if (field && !field.literal && !rules.providerPreservedPaths.includes(path)) {
            warnings.push(...scanResidual(field.raw, { knownMatches: knownMatches(field.raw), path, skipDates: mode === 'synthetic-test' }));
          }
        });
      }
      return warnings;
    },
    destroy() {
      maps.clear(); sequence.clear(); known.clear(); dateAnchor = null;
    },
  };
}

export function historySafeText(result) {
  const parsed = parseHl7(result.text);
  if (parsed.malformed || result.warnings.some(({ code }) => code === 'UNSTRUCTURED_TEXT_REVIEW')) {
    return '[UNSTRUCTURED-CONTENT-OMITTED-PENDING-REVIEW]';
  }
  const unknown = new Set(result.coverage?.unknownSegments || []);
  const paths = new Set(result.warnings.filter(({ code }) => code !== 'SYNTHETIC_NOT_DEIDENTIFIED').map(({ path }) => path));
  for (const segment of parsed.segments) {
    for (let index = 1; index < segment.fields.length; index += 1) {
      if (unknown.has(segment.name) || paths.has(`${segment.name}-${index}`)) {
        if (segment.fields[index].raw) segment.fields[index].raw = 'OMITTED-PENDING-REVIEW';
      }
    }
  }
  parsed.edited = true;
  return serializeHl7(parsed);
}
