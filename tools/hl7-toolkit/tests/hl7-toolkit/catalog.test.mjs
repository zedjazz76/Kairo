import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { catalogHl7 } from '../../hl7-toolkit/app/scripts/message-catalog.mjs';
import { processIntake } from '../../hl7-toolkit/app/workers/intake-worker.mjs';
import { createSanitizerSession } from '../../hl7-toolkit/app/scripts/sanitizer.mjs';

test('catalogs MLLP framed messages and exposes MSH metadata', async () => {
  const text = '\u000bMSH|^~\\&|A|F|B|F|202609031200||ORM^O01|ONE|P|2.5.1\rPID|1||MRN1\u001c\r' +
    '\u000bMSH|^~\\&|A|F|B|F|202609031201||ORU^R01|TWO|P|2.5.1\rPID|1||MRN2\u001c\r';
  const result = await catalogHl7(text);

  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[1].controlId, 'TWO');
  assert.equal(result.messages[1].type, 'ORU^R01');
  assert.equal(result.messages[1].family, 'ORU');
  assert.equal(result.messages[1].framing, 'MLLP');
  assert.equal(result.messages[1].text.startsWith('MSH|'), true);
  assert.equal(result.messages[1].text.includes('\u001c'), false);
});

test('catalogs prefixed logs and reports batch and prefix warnings', async () => {
  const source = readFileSync('tests/hl7-toolkit/fixtures/synthetic/messages.hl7', 'utf8');
  const result = await catalogHl7(source);

  assert.deepEqual(result.messages.map(({ controlId }) => controlId), ['ADT-1001', 'ORU-1002', 'SIU-1003']);
  assert.ok(result.warnings.some(({ code }) => code === 'BATCH_HEADERS_PRESENT'));
  assert.ok(result.warnings.some(({ code }) => code === 'LOG_PREFIX_IGNORED'));
});

test('reports progress, honors cancellation, and enforces the 100 MB boundary', async () => {
  const line = 'MSH|^~\\&|A|F|B|F|202609031200||ADT^A01|ONE|P|2.5.1\rPID|1||MRN1\r';
  const source = line.repeat(20000);
  const controller = new AbortController();
  let progressCount = 0;

  await assert.rejects(
    catalogHl7(source, {
      chunkSize: 65536,
      onProgress: () => {
        progressCount += 1;
        controller.abort();
      },
      signal: controller.signal,
    }),
    (error) => error?.name === 'AbortError',
  );
  assert.ok(progressCount >= 1);

  await assert.rejects(
    catalogHl7('X'.repeat(104857601)),
    (error) => error?.code === 'FILE_TOO_LARGE',
  );
});

test('worker intake emits selectable messages and progress before completion', async () => {
  const events = [];
  const file = new Blob(['MSH|^~\\&|A|F|B|F|202609031200||ADT^A01|WORKER-1|P|2.5.1\rPID|1||SYNTHETIC\r']);
  await processIntake({ id: 'intake-1', file }, { emit: (event) => events.push(event) });

  assert.deepEqual(events.map(({ type }) => type), ['messages', 'progress', 'complete']);
  assert.equal(events[0].messages[0].controlId, 'WORKER-1');
  assert.equal(events[2].count, 1);
  assert.equal(events[2].id, 'intake-1');
});

test('worker produces conservative sanitized archive chunks without raw canaries', async () => {
  const rules = JSON.parse(readFileSync('hl7-toolkit/app/definitions/phi-rules.v1.json', 'utf8'));
  const events = [];
  await processIntake({ id: 'privacy-intake', text: 'MSH|^~\\&|A|F|B|F|202609031200||ADT^A01|CANARY-CTRL|P|2.5.1\rPID|1||CANARY-MRN\rZXY|UNKNOWNCANARY' }, {
    emit: (event) => events.push(event), sanitizer: createSanitizerSession(rules),
  });
  const archive = events.find(({ type }) => type === 'archive');
  assert.ok(archive);
  assert.doesNotMatch(archive.results.map(({ historyText }) => historyText).join(''), /CANARY/);
  assert.equal(archive.results[0].result.policyVersion, 'patient-phi-1.0.0');
});

test('canceling after early catalog results stops sanitizing the remaining batch', async () => {
  const controller = new AbortController(); let sanitizations = 0; let displayed = 0; let archived = 0;
  const message = 'MSH|^~\\&|TEST|FAC|TOOL|FAC|202609031200||ADT^A01|CTRL|P|2.5.1\rPID|1||SYNTHETIC\r';
  await assert.rejects(processIntake({ id: 'cancel-archive', text: message.repeat(20000) }, {
    signal: controller.signal,
    emit: (event) => {
      if (event.type === 'messages') { displayed += event.messages.length; controller.abort(); }
      if (event.type === 'archive') archived += event.results.length;
    },
    sanitizer: { sanitize: () => { sanitizations += 1; return { text: message, warnings: [], coverage: {} }; } },
  }), { name: 'AbortError' });
  assert.ok(sanitizations < 1000, 'Cancellation must stop the remaining batch promptly.');
  assert.equal(archived, displayed, 'Every displayed message must have its sanitized archive queued even on cancellation.');
});
