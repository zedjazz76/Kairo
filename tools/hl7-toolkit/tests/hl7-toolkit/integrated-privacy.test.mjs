import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { startService } from './helpers/service-harness.mjs';
import { createApi } from '../../hl7-toolkit/app/scripts/api.mjs';
import { createSanitizerSession, historySafeText } from '../../hl7-toolkit/app/scripts/sanitizer.mjs';
import { processIntake } from '../../hl7-toolkit/app/workers/intake-worker.mjs';
import { createHistoryQueue } from '../../hl7-toolkit/app/scripts/history-queue.mjs';
import { countWarningTypes, copySanitized } from '../../hl7-toolkit/app/scripts/clipboard.mjs';
import { parseHl7 } from '../../hl7-toolkit/app/scripts/hl7-parser.mjs';
import { applyEdit } from '../../hl7-toolkit/app/scripts/editor.mjs';
import { semanticDiff } from '../../hl7-toolkit/app/scripts/diff.mjs';
import { createSingleSender } from '../../hl7-toolkit/app/scripts/send-workflow.mjs';

const rules = JSON.parse(readFileSync('hl7-toolkit/app/definitions/phi-rules.v1.json', 'utf8'));
const raw = 'MSH|^~\\&|TOOL|TEST|STUB|TEST|202609031200||ORM^O01|RAWCANARYCONTROL|P|2.5.1\rPID|1||RAWCANARYPATIENT||RAWCANARYFAMILY^RAWCANARYGIVEN\rNTE|1||RAWCANARYNARRATIVE\r';
const audit = (result, type = 'message-save') => ({ schema: 'hl7-toolkit.sanitized-event.v1', type, policyVersion: rules.version, mode: 'chat-safe', sanitizedText: historySafeText(result), warningCounts: countWarningTypes(result.warnings), overrideCount: 0 });
const diskText = (root) => readdirSync(root, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => readFileSync(path.join(entry.parentPath, entry.name), 'utf8')).join('\n');

test('import, edit, compare, copy, and actual local send persist no raw patient canary', async () => {
  const service = await startService();
  const api = createApi({ ...service, sessionId: 'integrated-privacy' });
  const sanitizer = createSanitizerSession(rules);
  const queue = createHistoryQueue(api.saveSanitizedEvent);
  const catalog = [];
  let frames = 0;
  const receiver = net.createServer((socket) => {
    socket.on('error', () => {}); let data = '';
    socket.on('data', (chunk) => { data += chunk; if (data.endsWith('\x1c\r')) { frames += 1; socket.end('\x0bMSH|^~\\&|STUB|TEST|TOOL|TEST|202609031200||ACK|ACK1|P|2.5.1\rMSA|AA|RAWCANARYCONTROL\r\x1c\r'); } });
  });
  await new Promise((resolve) => receiver.listen(0, '127.0.0.1', resolve));
  try {
    await processIntake({ id: 'integrated', text: raw }, { sanitizer, emit: (event) => {
      if (event.type === 'messages') catalog.push(...event.messages);
      if (event.type === 'archive') for (const item of event.results) queue.save(audit(item.result)).catch(() => {});
    } });
    await queue.ready(); assert.equal(catalog.length, 1);
    const edited = applyEdit(parseHl7(catalog[0].text), { type: 'set-value', path: 'PID-5.1', value: 'RAWCANARYEDITED' }).after;
    await queue.save(audit(sanitizer.sanitize(edited)));
    assert.ok(semanticDiff(parseHl7(raw), parseHl7(edited)).some((change) => change.path === 'PID-5.1'));
    await queue.save({ ...audit(sanitizer.sanitize(edited), 'comparison-save'), sanitizedText: [raw, edited].map((text) => historySafeText(sanitizer.sanitize(text))).join('\r') });
    const copy = sanitizer.sanitize(edited.replace(/NTE[^\r]*\r/, ''));
    let copied = '';
    await copySanitized(copy, { saveEvent: queue.save, acknowledgedWarningIds: copy.warnings.map((warning) => warning.id), rescan: (text) => sanitizer.scan(text), clipboard: { writeText: async (text) => { copied = text; } } });
    assert.doesNotMatch(copied, /RAWCANARY/);
    const profile = { schema: 'hl7-toolkit.endpoint-profile.v1', id: 'loopback', label: 'Synthetic loopback', environment: 'Test', host: '127.0.0.1', port: receiver.address().port, connectTimeoutMs: 1000, responseTimeoutMs: 1000, encoding: 'utf-8', startByte: 11, endBytes: [28, 13], notes: '' };
    const sender = createSingleSender({ getSnapshot: () => ({ text: edited, profile, mode: 'original', dirty: false }), historyReady: queue.ready, sanitize: async (text, mode) => sanitizer.sanitize(text, mode), saveEvent: queue.save, send: (body) => api.request('/api/mllp/send-one', { method: 'POST', body }), confirm: async (review) => ({ confirmed: true, acknowledgedIds: review.requiredIds || [] }) });
    const result = await sender.run(); assert.equal(result.ack.accepted, true); assert.equal(frames, 1);
    sanitizer.destroy();
    const detail = await api.getHistory('integrated-privacy'); assert.equal(detail.events.length, 6);
    assert.doesNotMatch(diskText(service.dataRoot) + service.diagnostics(), /RAWCANARY/);
    await api.deleteHistory(['integrated-privacy']); assert.equal((await api.getHistory()).sessions.length, 0);
  } finally { await new Promise((resolve) => receiver.close(resolve)); await service.stop(); }
});

test('100 MB intake sanitizes and durably saves every displayed message', { timeout: 180000 }, async (context) => {
  const service = await startService();
  const api = createApi({ ...service, sessionId: 'large-intake' });
  const queue = createHistoryQueue(api.saveSanitizedEvent);
  const sanitizer = createSanitizerSession(rules);
  const line = raw + 'OBX|1|TX|NOTE||' + 'SYNTHETIC ONLY '.repeat(150) + '\r';
  const text = line.repeat(Math.ceil(104857600 / line.length)).slice(0, 104857600);
  let displayed = 0; let archived = 0; let writes = 0;
  const start = performance.now();
  try {
    await processIntake({ id: 'large', file: new Blob([text]) }, { sanitizer, emit: (event) => {
      if (event.type === 'messages') displayed += event.messages.length;
      if (event.type === 'archive') {
        archived += event.results.length; writes += 1;
        queue.save({ schema: 'hl7-toolkit.sanitized-event.v1', type: 'message-save', sanitizedText: event.results.map((item) => item.historyText).join('\r'), policyVersion: rules.version, mode: 'chat-safe', warningCounts: countWarningTypes(event.results.flatMap((item) => item.result.warnings)), overrideCount: 0 }).catch(() => {});
      }
    } });
    await queue.ready();
    const history = await api.getHistory();
    assert.ok(displayed > 40000); assert.equal(archived, displayed); assert.equal(history.sessions[0].eventCount, writes);
    assert.doesNotMatch(diskText(service.dataRoot), /RAWCANARY/);
    context.diagnostic('100 MB full intake + sanitizer + durable history: ' + Math.round(performance.now() - start) + ' ms; ' + displayed + ' messages; ' + writes + ' writes.');
  } finally { sanitizer.destroy(); await service.stop(); }
});
