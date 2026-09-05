import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { catalogHl7, MAX_FILE_BYTES } from '../../hl7-toolkit/app/scripts/message-catalog.mjs';
import { createSanitizerSession } from '../../hl7-toolkit/app/scripts/sanitizer.mjs';

const rules = JSON.parse(readFileSync('hl7-toolkit/app/definitions/phi-rules.v1.json', 'utf8'));
const synthetic = 'MSH|^~\\&|TEST|FAC|TOOL|FAC|202609031200||ORU^R01|CTRL-0001|P|2.5.1\rPID|1||MRN-0001||EXAMPLE^ALPHA\rOBX|1|TX|NOTE||' + 'SYNTHETIC ONLY '.repeat(150) + '\r';

test('catalogs exactly 100 MB progressively with early results and prompt cancellation', { timeout: 120000 }, async (context) => {
  const source = synthetic.repeat(Math.ceil(MAX_FILE_BYTES / synthetic.length)).slice(0, MAX_FILE_BYTES);
  let progressCount = 0; let early = false; let complete = false;
  const started = performance.now();
  const result = await catalogHl7(source, { onMessages: (messages) => { if (!complete && messages.length) early = true; }, onProgress: () => { progressCount += 1; } });
  complete = true;
  assert.equal(result.bytes, MAX_FILE_BYTES); assert.ok(result.messages.length > 40000);
  assert.ok(early); assert.ok(progressCount >= 50);
  const controller = new AbortController(); let abortedAt;
  await assert.rejects(catalogHl7(source, { signal: controller.signal, onProgress: () => { abortedAt = performance.now(); controller.abort(); } }), { name: 'AbortError' });
  assert.ok(performance.now() - abortedAt < 2000);
  context.diagnostic('100 MB catalog and cancellation: ' + Math.round(performance.now() - started) + ' ms; ' + result.messages.length + ' messages.');
});

test('sanitizer scales across distinct patients without losing earlier known identifiers', { timeout: 120000 }, (context) => {
  const session = createSanitizerSession(rules);
  const started = performance.now();
  for (let index = 0; index < 1500; index += 1) {
    const text = 'MSH|^~\\&|TEST|FAC|TOOL|FAC|202609031200||ADT^A01|CTRL' + index + '|P|2.5.1\rPID|1||UNIQUEPATIENT' + index + '||FAMILY' + index + '^GIVEN' + index + '\r';
    const result = session.sanitize(text);
    assert.doesNotMatch(result.text, /UNIQUEPATIENT|FAMILY\d|GIVEN\d/);
  }
  const elapsed = performance.now() - started;
  context.diagnostic('1,500 distinct-message sanitizations: ' + Math.round(elapsed) + ' ms.');
  assert.ok(elapsed < 5000, 'Distinct-patient indexing must avoid growing full-dictionary scans for every field.');
  assert.doesNotMatch(session.sanitize('Patient note: uniquepatient0 was referenced').text, /uniquepatient0/i);
  assert.ok(session.scan('UNIQUEPATIENT0').some((warning) => warning.code === 'KNOWN_VALUE'));
});
