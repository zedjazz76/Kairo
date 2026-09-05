import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHl7 } from '../../hl7-toolkit/app/scripts/hl7-parser.mjs';
import { evaluateProfile, validateProfilePack } from '../../hl7-toolkit/app/scripts/profile-validator.mjs';

const pack = {
  id: 'test-pack', profiles: [{
    id: 'oru-251', versions: ['2.5.1'], family: 'ORU',
    rules: [
      { kind: 'required', path: 'OBR-4', severity: 'error', suggestion: 'Add the local service identifier.' },
      { kind: 'value-set', path: 'OBX-11', allowedValues: ['F', 'C'], severity: 'warning', suggestion: 'Use a local final or corrected status.' },
      { kind: 'segment', name: 'ZLR', minOccurs: 1, severity: 'warning', suggestion: 'Add the locally required ZLR segment.' },
    ],
  }],
};

function message(version = '2.5.1', type = 'ORU^R01') {
  return parseHl7(`MSH|^~\\&|A|F|B|F|202609051200||${type}|CTRL-1|P|${version}\rOBR|1|||\rOBX|1|ST|CODE||value||||||X`);
}

test('evaluates matching version family and profile rules without mutating source', () => {
  const original = message();
  const findings = evaluateProfile(original, pack);
  assert.deepEqual(findings.map(({ code }) => code), ['PROFILE_REQUIRED', 'PROFILE_VALUE_SET', 'PROFILE_SEGMENT_CARDINALITY']);
  assert.equal(findings[0].suggestion, 'Add the local service identifier.');
  assert.equal(original.source.includes('ZLR'), false);
});

test('reports not evaluated when no profile matches declared version and family', () => {
  const findings = evaluateProfile(message('2.3'), pack);
  assert.deepEqual(findings.map(({ code, severity }) => ({ code, severity })), [{ code: 'PROFILE_NOT_AVAILABLE', severity: 'not-evaluated' }]);
});

test('rejects an invalid pack without echoing its content', () => {
  assert.throws(() => validateProfilePack({ id: 'secret-local-profile', profiles: [{}] }), (error) => error.code === 'PROFILE_PACK_INVALID' && !error.message.includes('secret'));
});
