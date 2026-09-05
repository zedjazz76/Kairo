import assert from 'node:assert/strict';
import test from 'node:test';

import {
  flattenPaths,
  getValue,
  parseHl7,
  serializeHl7,
} from '../../hl7-toolkit/app/scripts/hl7-parser.mjs';

test('parses custom delimiters and preserves an untouched message exactly', () => {
  const source = 'MSH*$%!?*SEND*FAC*RECV*FAC*202609031200**ADT$A01*CTRL-1*P*2.5.1\rZXY*1**A$B';
  const parsed = parseHl7(source);

  assert.deepEqual(parsed.delimiters, {
    field: '*',
    component: '$',
    repetition: '%',
    escape: '!',
    subcomponent: '?',
  });
  assert.equal(parsed.segments[1].name, 'ZXY');
  assert.equal(getValue(parsed, 'MSH-9.2'), 'A01');
  assert.equal(serializeHl7(parsed), source);
});

test('keeps CRLF endings, empty values, repetitions, escapes, and subcomponents', () => {
  const source = 'MSH|^~\\&|SEND||RECV|FAC|202609031200||ORU^R01|CTRL-2|P|2.5.1\r\n' +
    'PID|1||MRN-A~MRN-B^^^AUTH&ISO||FAMILY^GIVEN||\r\n' +
    'OBX|1|TX|NOTE||Line one\\.br\\line two\r\n';
  const parsed = parseHl7(source);

  assert.equal(parsed.segmentDelimiter, '\r\n');
  assert.equal(getValue(parsed, 'PID-2'), '');
  assert.equal(getValue(parsed, 'PID-3[1]'), 'MRN-A');
  assert.equal(getValue(parsed, 'PID-3[2].4.1'), 'AUTH');
  assert.equal(getValue(parsed, 'PID-3[2].4.2'), 'ISO');
  assert.equal(getValue(parsed, 'OBX-5'), 'Line one\\.br\\line two');
  assert.equal(serializeHl7(parsed), source);

  const paths = flattenPaths(parsed);
  assert.equal(paths.get('PID-3[2].4.2'), 'ISO');
});

test('returns a lossless malformed representation when MSH is missing', () => {
  const source = 'PID|1||SYNTHETIC\nZXY|1|VALUE';
  const parsed = parseHl7(source);

  assert.equal(parsed.malformed, true);
  assert.equal(parsed.warnings[0].code, 'MSH_MISSING');
  assert.equal(serializeHl7(parsed), source);
});
