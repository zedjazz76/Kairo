import { getValue } from './hl7-parser.mjs';

function invalidPack() {
  const error = new Error('The validation profile format is not supported.');
  error.code = 'PROFILE_PACK_INVALID';
  return error;
}

function validRule(rule) {
  if (!rule || !['required', 'value-set', 'segment'].includes(rule.kind) || !['error', 'warning', 'information'].includes(rule.severity)) return false;
  if (rule.kind === 'segment') return /^[A-Z][A-Z0-9]{2}$/.test(rule.name) && Number.isInteger(rule.minOccurs) && rule.minOccurs >= 0;
  if (!/^[A-Z0-9]{3}-\d+$/.test(rule.path)) return false;
  return rule.kind !== 'value-set' || (Array.isArray(rule.allowedValues) && rule.allowedValues.every((value) => typeof value === 'string'));
}

export function validateProfilePack(pack) {
  if (!pack || typeof pack.id !== 'string' || !Array.isArray(pack.profiles)) throw invalidPack();
  if (pack.collectionRules !== undefined && (!Array.isArray(pack.collectionRules) || !pack.collectionRules.every((rule) => rule?.kind === 'unique-control-id' && ['error', 'warning', 'information'].includes(rule.severity)))) throw invalidPack();
  for (const profile of pack.profiles) {
    if (!profile || typeof profile.id !== 'string' || !Array.isArray(profile.versions) || !profile.versions.every((value) => typeof value === 'string') || !/^[A-Z0-9]{3}$/.test(profile.family) || !Array.isArray(profile.rules) || !profile.rules.every(validRule)) throw invalidPack();
  }
  return structuredClone(pack);
}

export function evaluateCollection(messages, inputPack) {
  const pack = validateProfilePack(inputPack);
  const findings = [];
  for (const rule of pack.collectionRules || []) {
    if (rule.kind !== 'unique-control-id') continue;
    const counts = new Map();
    for (const message of messages) if (message.controlId) counts.set(message.controlId, (counts.get(message.controlId) || 0) + 1);
    const duplicates = [...counts.values()].reduce((total, count) => total + Math.max(0, count - 1), 0);
    if (duplicates) findings.push({ id: 'PROFILE_COLLECTION_DUPLICATE:catalog', code: 'PROFILE_COLLECTION_DUPLICATE', severity: rule.severity, path: 'catalog', summary: `A configured collection rule found ${duplicates} duplicate control-ID occurrence${duplicates === 1 ? '' : 's'}.`, source: 'Stage 3 profile validation', overridable: true });
  }
  return findings;
}

function profileFinding(code, rule, path, summary) {
  return {
    id: `${code}:${path}`, code, severity: rule.severity, path, summary,
    source: 'Stage 3 profile validation', overridable: true,
    ...(rule.suggestion ? { suggestion: rule.suggestion } : {}),
  };
}

function matchProfile(message, pack) {
  const version = getValue(message, 'MSH-12');
  const family = (getValue(message, 'MSH-9') || '').split(message.delimiters.component)[0];
  return pack.profiles.find((profile) => profile.family === family && profile.versions.includes(version));
}

export function evaluateProfile(message, inputPack) {
  const pack = validateProfilePack(inputPack);
  const profile = matchProfile(message, pack);
  if (!profile) return [{ id: 'PROFILE_NOT_AVAILABLE:message', code: 'PROFILE_NOT_AVAILABLE', severity: 'not-evaluated', path: 'message', summary: 'No loaded validation profile covers this declared version and message family.', source: 'Stage 3 profile validation', overridable: true }];
  const findings = [];
  for (const rule of profile.rules) {
    if (rule.kind === 'required' && !getValue(message, rule.path)?.trim()) findings.push(profileFinding('PROFILE_REQUIRED', rule, rule.path, 'A profile-required value is missing.'));
    if (rule.kind === 'value-set') {
      const value = getValue(message, rule.path);
      if (value?.trim() && !rule.allowedValues.includes(value)) findings.push(profileFinding('PROFILE_VALUE_SET', rule, rule.path, 'This value is outside the loaded profile value set.'));
    }
    if (rule.kind === 'segment') {
      const count = message.segments.filter(({ name }) => name === rule.name).length;
      if (count < rule.minOccurs) findings.push(profileFinding('PROFILE_SEGMENT_CARDINALITY', rule, rule.name, 'The loaded profile requires more occurrences of this segment.'));
    }
  }
  return findings;
}
