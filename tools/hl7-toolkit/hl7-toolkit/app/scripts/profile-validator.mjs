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
  for (const profile of pack.profiles) {
    if (!profile || typeof profile.id !== 'string' || !Array.isArray(profile.versions) || !profile.versions.every((value) => typeof value === 'string') || !/^[A-Z0-9]{3}$/.test(profile.family) || !Array.isArray(profile.rules) || !profile.rules.every(validRule)) throw invalidPack();
  }
  return structuredClone(pack);
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
