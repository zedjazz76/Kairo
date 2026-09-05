import { scanResidual } from './residual-scan.mjs';

export function countWarningTypes(warnings) {
  const counts = {};
  for (const warning of warnings) counts[warning.code] = (counts[warning.code] || 0) + 1;
  return counts;
}

export async function copySanitized(result, {
  acknowledgedWarningIds = [],
  saveEvent,
  clipboard = navigator.clipboard,
  rescan = (text) => scanResidual(text),
} = {}) {
  if (!result || typeof result.text !== 'string' || !result.policyVersion) throw new Error('SANITIZED_RESULT_REQUIRED');
  const warnings = [...new Map([...result.warnings, ...rescan(result.text, result.mode)].map((item) => [item.id, item])).values()];
  const acknowledged = new Set(acknowledgedWarningIds);
  const unresolved = warnings.filter((item) => !acknowledged.has(item.id));
  if (unresolved.length) {
    const error = new Error('UNRESOLVED_SANITIZER_WARNINGS');
    error.warnings = unresolved;
    throw error;
  }
  if (typeof saveEvent !== 'function') throw new Error('HISTORY_WRITER_REQUIRED');
  await saveEvent({
    schema: 'hl7-toolkit.sanitized-event.v1', type: 'clipboard-copy',
    sanitizedText: result.text, warningCounts: countWarningTypes(warnings),
    policyVersion: result.policyVersion, mode: result.mode,
    overrideCount: warnings.length, outcome: 'authorized',
  });
  await clipboard.writeText(result.text);
  return { copiedCharacters: result.text.length, overrideCount: warnings.length };
}
