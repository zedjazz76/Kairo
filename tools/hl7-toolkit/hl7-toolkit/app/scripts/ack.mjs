import { parseHl7, getValue } from './hl7-parser.mjs';

const CATEGORIES = { AA: 'application-accept', AE: 'application-error', AR: 'application-reject', CA: 'commit-accept', CE: 'commit-error', CR: 'commit-reject' };

export function analyzeAck(text, outboundControlId) {
  const message = parseHl7(text || '');
  const code = getValue(message, 'MSA-1') || '';
  const acknowledgedId = getValue(message, 'MSA-2') || '';
  const valid = !message.malformed && message.segments[0]?.name === 'MSH' &&
    message.segments.filter((segment) => segment.name === 'MSH').length === 1 &&
    message.segments.filter((segment) => segment.name === 'MSA').length === 1 &&
    Boolean(CATEGORIES[code]) && Boolean(acknowledgedId);
  const correlated = valid && Boolean(outboundControlId) && acknowledgedId === outboundControlId;
  const errors = message.segments.filter((segment) => segment.name === 'ERR').map((segment) => {
    const value = (index) => segment.fields[index]?.raw || '';
    const coded = value(3).split(message.delimiters.component);
    return { location: value(2) || value(1), code: coded[0] || '', description: coded[1] || '', severity: value(4), applicationCode: value(5), diagnostic: value(7), userMessage: value(8) };
  });
  return { valid, code, category: valid ? CATEGORIES[code] : 'unknown-ack', acknowledgedId, correlated,
    accepted: correlated && code === 'AA', applicationStatus: correlated && ['AA', 'AE', 'AR'].includes(code) ? CATEGORIES[code] : 'not-confirmed',
    message: getValue(message, 'MSA-3') || '', errors };
}
