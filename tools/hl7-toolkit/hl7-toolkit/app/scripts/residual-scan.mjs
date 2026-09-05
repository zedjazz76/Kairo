const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?<!\d)(?:\+?1[- .]?)?(?:\(\d{3}\)|\d{3})[- .]\d{3}[- .]\d{4}(?:\s*(?:x|ext\.?)\s*\d+)?\b/gi;
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
const IP_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const URL_PATTERN = /https?:\/\/[^\s|^~\\&]+/gi;
const DATE_PATTERN = /\b(?:(?:18|19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/](?:\d{4}|\d{2})|(?:18|19|20)\d{2}(?:0[1-9]|1[012])(?:0[1-9]|[12]\d|3[01])(?:\d{2}){0,3}(?:[+-]\d{4})?)\b/g;

const patterns = [
  ['EMAIL', 'email', EMAIL_PATTERN], ['SSN', 'national-id', SSN_PATTERN],
  ['PHONE', 'contact', PHONE_PATTERN], ['IP_ADDRESS', 'ip-address', IP_PATTERN],
  ['URL', 'url', URL_PATTERN], ['DATE', 'date', DATE_PATTERN],
];

function warning(code, length, index = 0, path = '') {
  return { id: `${code}:${path}:${index}`, code, path, index, length, confidence: 'pattern', summary: `Review possible ${code.toLowerCase().replaceAll('_', ' ')} content.` };
}

function applyPattern(warnings, text, code, pattern, path) {
  for (const match of text.matchAll(new RegExp(pattern.source, pattern.flags))) {
    warnings.push(warning(code, match[0].length, match.index, path));
  }
}

function deduplicateWarnings(warnings) {
  return [...new Map(warnings.map((item) => [item.id, item])).values()];
}

export function redactPatterns(text, replace, { skipDates = false } = {}) {
  let output = text;
  for (const [code, category, pattern] of patterns) {
    if (skipDates && code === 'DATE') continue;
    output = output.replace(new RegExp(pattern.source, pattern.flags), (value) => replace(category, value));
  }
  output = output.replace(/\b(?:9\d|1\d\d)\s*(?:years?\s*old|yrs?\s*old|y\/?o)\b/gi, 'AGE-90-PLUS');
  return output;
}

export function scanResidual(text, { knownRawValues = [], knownMatches = [], path = '', skipDates = false } = {}) {
  const warnings = [];
  for (const match of knownMatches) warnings.push(warning('KNOWN_VALUE', match.length, match.index, path));
  for (const value of knownRawValues.filter((item) => item.length >= 3)) {
    const index = text.indexOf(value);
    if (index >= 0) warnings.push(warning('KNOWN_VALUE', value.length, index, path));
  }
  for (const [code, , pattern] of patterns) {
    if (skipDates && code === 'DATE') continue;
    applyPattern(warnings, text, code, pattern, path);
  }
  return deduplicateWarnings(warnings);
}
