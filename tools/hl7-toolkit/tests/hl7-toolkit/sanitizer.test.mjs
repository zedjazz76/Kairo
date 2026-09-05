import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getValue, parseHl7 } from '../../hl7-toolkit/app/scripts/hl7-parser.mjs';
import { createSanitizerSession, historySafeText } from '../../hl7-toolkit/app/scripts/sanitizer.mjs';
import { scanResidual } from '../../hl7-toolkit/app/scripts/residual-scan.mjs';

const rules = JSON.parse(readFileSync('hl7-toolkit/app/definitions/phi-rules.v1.json', 'utf8'));
const header = 'MSH|^~\\&|APP|TEST|TOOL|TEST|202609031200||ORU^R01|CTRL-CANARY-991|P|2.5.1\r';
function segment(name, values) {
  const fields = Array(Math.max(...Object.keys(values).map(Number)) + 1).fill('');
  fields[0] = name;
  for (const [index, value] of Object.entries(values)) fields[Number(index)] = value;
  return fields.join('|');
}

test('replaces patients consistently and preserves configured provider fields', () => {
  const session = createSanitizerSession(rules);
  const first = parseHl7(header + 'PID|1||CANARY-MRN-771||CANARYFAMILY^CANARYGIVEN||19800506\r' +
    segment('OBR', { 1: '1', 2: 'ORDER-CANARY-88', 16: '1234^VISIBLEPROVIDER^ALICE' }));
  const second = parseHl7(header + 'PID|1||CANARY-MRN-771||CANARYFAMILY^CANARYGIVEN||19800506\r' +
    'OBX|1|TX|NOTE||Patient CANARYGIVEN CANARYFAMILY called from 555-555-0199');
  const one = session.sanitize(first, 'chat-safe');
  const two = session.sanitize(second, 'chat-safe');

  assert.match(one.text, /VISIBLEPROVIDER\^ALICE/);
  assert.doesNotMatch(one.text + two.text, /CANARY|19800506|555-555-0199/);
  assert.equal(getValue(parseHl7(one.text), 'PID-3'), 'MRN-0001');
  assert.equal(getValue(parseHl7(two.text), 'PID-3'), 'MRN-0001');
  assert.ok(two.warnings.some(({ code }) => code === 'FREE_TEXT_REVIEW'));
  assert.doesNotMatch(JSON.stringify({ replacements: one.replacements, warnings: one.warnings, coverage: one.coverage }), /CANARY/);
  assert.equal('reversibleMap' in one, false);
});

test('sanitizes patient roles even when identical text is intentionally preserved in provider roles', () => {
  const session = createSanitizerSession(rules);
  const result = session.sanitize(parseHl7(header + 'PID|1||SYNTH-MRN||SAMEFAMILY^SAMEGIVEN\r' +
    segment('PV1', { 1: '1', 7: 'PROVIDER-ID^SAMEFAMILY^SAMEGIVEN' })), 'chat-safe');
  const parsed = parseHl7(result.text);

  assert.doesNotMatch(getValue(parsed, 'PID-5'), /SAME/);
  assert.equal(getValue(parsed, 'PV1-7'), 'PROVIDER-ID^SAMEFAMILY^SAMEGIVEN');
});

test('preserves identifier domains and state while replacing patient address details', () => {
  const result = createSanitizerSession(rules).sanitize(parseHl7(header + segment('PID', {
    1: '1', 3: 'PATIENT-ID^^^TESTAUTH^MR~OTHER-ID^^^ALT^MR',
    11: '11 Canary Lane^Suite 9^Canary City^AR^72701^USA^H',
    13: '555-555-0199^PRN^PH^^1^479^5550199',
  })), 'chat-safe');
  const parsed = parseHl7(result.text);

  assert.equal(getValue(parsed, 'PID-3[1].4'), 'TESTAUTH');
  assert.equal(getValue(parsed, 'PID-3[1].5'), 'MR');
  assert.equal(getValue(parsed, 'PID-11.4'), 'AR');
  assert.equal(getValue(parsed, 'PID-11.6'), 'USA');
  assert.doesNotMatch(result.text, /Canary|72701|5550199|555-555-0199|PATIENT-ID|OTHER-ID/);
});

test('chat-safe removes calendar dates and synthetic-test shifts all full dates consistently', () => {
  const source = parseHl7(header + segment('PV1', { 1: '1', 44: '202609011200', 45: '202609041200' }));
  const session = createSanitizerSession(rules, { dateShiftDays: -365 });
  const chat = session.sanitize(source, 'chat-safe');
  const synthetic = session.sanitize(source, 'synthetic-test');

  assert.doesNotMatch(chat.text, /202609/);
  assert.match(getValue(parseHl7(chat.text), 'PV1-44'), /^REL-DAY/);
  assert.equal(getValue(parseHl7(synthetic.text), 'PV1-44'), '202509011200');
  assert.equal(getValue(parseHl7(synthetic.text), 'PV1-45'), '202509041200');
  assert.ok(synthetic.warnings.some(({ code }) => code === 'SYNTHETIC_NOT_DEIDENTIFIED'));
});

test('quick text sanitization replaces labeled PHI and flags unstructured coverage', () => {
  const result = createSanitizerSession(rules).sanitize(parseHl7(
    'Patient: CANARYPERSON\nMRN: 99182744\nDOB: 1980-05-06\nEmail: canary@example.com\nPhone: 555-555-0188\nSSN: 111-22-3333\nIP: 192.0.2.77',
  ), 'chat-safe');

  assert.doesNotMatch(result.text, /CANARYPERSON|99182744|1980-05-06|canary@example.com|555-555-0188|111-22-3333|192\.0\.2\.77/);
  assert.ok(result.warnings.some(({ code }) => code === 'UNSTRUCTURED_TEXT_REVIEW'));
});

test('unknown segments remain inspectable but require review and residual warnings never contain matches', () => {
  const result = createSanitizerSession(rules).sanitize(parseHl7(header + 'ZXY|1|arbitrary narrative'), 'chat-safe');
  assert.match(result.text, /ZXY\|1\|arbitrary narrative/);
  assert.ok(result.warnings.some(({ code }) => code === 'UNKNOWN_SEGMENT_REVIEW'));

  const warnings = scanResidual('Contact raw@example.com or 555-555-0199. CANARYSECRET', { knownRawValues: ['CANARYSECRET'] });
  assert.ok(warnings.some(({ code }) => code === 'EMAIL'));
  assert.ok(warnings.some(({ code }) => code === 'KNOWN_VALUE'));
  assert.doesNotMatch(JSON.stringify(warnings), /raw@example.com|CANARYSECRET|555-555-0199/);
});

test('synthetic date shifting preserves fractional time and signed timezone', () => {
  const source = parseHl7(header.replace('202609031200', '20260903120000.123-0500'));
  const result = createSanitizerSession(rules, { dateShiftDays: -365 }).sanitize(source, 'synthetic-test');
  assert.equal(getValue(parseHl7(result.text), 'MSH-7'), '20250903120000.123-0500');
});

test('typed observation names and embedded attachments do not escape the patient-PHI boundary', () => {
  const result = createSanitizerSession(rules).sanitize(parseHl7(header +
    'OBX|1|XPN|PATIENTNAME||OBXCANARYFAMILY^OBXCANARYGIVEN\r' +
    'OBX|2|ED|ATTACHMENT||APP^TEXT^PLAIN^Base64^UkFXUEhJQ0FOQVJZ\r'), 'chat-safe');
  assert.doesNotMatch(result.text, /OBXCANARY|UkFXUEhJQ0FOQVJZ/);
  assert.ok(result.warnings.some(({ code }) => code === 'EMBEDDED_CONTENT_REMOVED'));
});

test('automatic history omits unreviewed narrative and unknown-segment content', () => {
  const result = createSanitizerSession(rules).sanitize(parseHl7(header +
    'PID|1||CANARY-ID\rNTE|1||UNDETECTEDNAME\rZXY|UNKNOWNIDENTITY'), 'chat-safe');
  const saved = historySafeText(result);
  assert.match(saved, /MRN-0001/);
  assert.doesNotMatch(saved, /CANARY-ID|UNDETECTEDNAME|UNKNOWNIDENTITY/);
  assert.match(saved, /OMITTED-PENDING-REVIEW/);
});
