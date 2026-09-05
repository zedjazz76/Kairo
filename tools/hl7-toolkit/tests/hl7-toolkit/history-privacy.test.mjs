import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import test from 'node:test';
import { copySanitized } from '../../hl7-toolkit/app/scripts/clipboard.mjs';
import { createApi } from '../../hl7-toolkit/app/scripts/api.mjs';

function allText(root) {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => readFileSync(path.join(entry.parentPath, entry.name), 'utf8')).join('\n');
}

function runHistory(command, dataRoot) {
  const script = "$ErrorActionPreference = 'Stop'; Import-Module './hl7-toolkit/service/HL7Toolkit.History.psm1' -Force; " +
    "$dataRoot = '" + dataRoot.replaceAll("'", "''") + "'; " + command;
  return spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { encoding: 'utf8' });
}

test('history persists sanitized content, rejects raw properties, and deletes exact sessions only', () => {
  const dataRoot = mkdtempSync(path.join(tmpdir(), 'hl7-history-'));
  try {
    const result = runHistory([
      "$event = [pscustomobject]@{schema='hl7-toolkit.sanitized-event.v1';type='message-save';sanitizedText='MRN-0001';policyVersion='patient-phi-1.0.0';mode='chat-safe';warningCounts=@{};overrideCount=0}",
      '$event = $event | ConvertTo-Json -Depth 10 | ConvertFrom-Json',
      'Write-HL7SanitizedEvent -DataRoot $dataRoot -SessionId session-one -Event $event | Out-Null',
      'Write-HL7SanitizedEvent -DataRoot $dataRoot -SessionId session-two -Event $event | Out-Null',
      "$bad = [pscustomobject]@{schema='hl7-toolkit.sanitized-event.v1';type='message-save';sanitizedText='MRN-0001';rawText='RAW-PHI-CANARY-991827';policyVersion='patient-phi-1.0.0'}",
      "$rejected=$false; try { Write-HL7SanitizedEvent -DataRoot $dataRoot -SessionId session-one -Event $bad | Out-Null } catch { $rejected=$true }; if (-not $rejected) { throw 'raw event accepted' }",
      "$escaped=$false; try { Remove-HL7History -DataRoot $dataRoot -SessionIds @('../outside') | Out-Null } catch { $escaped=$true }; if (-not $escaped) { throw 'traversal accepted' }",
      '$deleted = Remove-HL7History -DataRoot $dataRoot -SessionIds @(\'session-two\')',
      "if ($deleted.deletedCount -ne 1) { throw 'wrong delete count' }",
      '$history = Get-HL7History -DataRoot $dataRoot',
      "if ($history.sessions.Count -ne 1 -or $history.sessions[0].sessionId -ne 'session-one') { throw 'wrong remaining session' }",
      '$history | ConvertTo-Json -Depth 10 -Compress',
    ].join('; '), dataRoot);
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.match(allText(dataRoot), /MRN-0001/);
    assert.doesNotMatch(allText(dataRoot), /RAW-PHI-CANARY-991827|rawText/);
    assert.equal(readdirSync(path.join(dataRoot, 'history', 'session-one')).some((name) => name.endsWith('.tmp')), false);
  } finally {
    assert.ok(path.resolve(dataRoot).startsWith(path.resolve(tmpdir()) + path.sep));
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('copy requires every warning acknowledgement and saves its sanitized audit before clipboard access', async () => {
  const actions = [];
  const result = { text: 'MRN-0001', warnings: [{ id: 'review:1', code: 'FREE_TEXT_REVIEW' }], policyVersion: 'patient-phi-1.0.0', mode: 'chat-safe' };
  const options = {
    saveEvent: async (event) => { actions.push(['audit', event]); },
    clipboard: { writeText: async (text) => { actions.push(['clipboard', text]); } },
    rescan: () => [],
  };
  await assert.rejects(copySanitized(result, options), /UNRESOLVED_SANITIZER_WARNINGS/);
  assert.equal(actions.length, 0);

  const receipt = await copySanitized(result, { ...options, acknowledgedWarningIds: ['review:1'] });
  assert.deepEqual(actions.map(([action]) => action), ['audit', 'clipboard']);
  assert.equal(actions[0][1].sanitizedText, 'MRN-0001');
  assert.equal(actions[0][1].overrideCount, 1);
  assert.equal(actions[1][1], 'MRN-0001');
  assert.equal(receipt.copiedCharacters, 8);
});

test('copy blocks on a new residual warning or a failed history write', async () => {
  const result = { text: 'MRN-0001', warnings: [], policyVersion: 'patient-phi-1.0.0', mode: 'chat-safe' };
  let clipboardWrites = 0;
  const clipboard = { writeText: async () => { clipboardWrites += 1; } };
  await assert.rejects(copySanitized(result, {
    clipboard, saveEvent: async () => {}, rescan: () => [{ id: 'new:1', code: 'KNOWN_VALUE' }],
  }), /UNRESOLVED_SANITIZER_WARNINGS/);
  await assert.rejects(copySanitized(result, {
    clipboard, saveEvent: async () => { throw new Error('HISTORY_WRITE_FAILED'); }, rescan: () => [],
  }), /HISTORY_WRITE_FAILED/);
  assert.equal(clipboardWrites, 0);
});

test('API sends authenticated sanitized history only to a loopback helper', async () => {
  let received;
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    received = { token: request.headers['x-hl7-token'], path: request.url, payload: JSON.parse(body) };
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end('{"saved":true}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const api = createApi({ token: 'test-token', sessionId: 'client-session', baseUrl: `http://127.0.0.1:${server.address().port}` });
    const result = await api.saveSanitizedEvent({ schema: 'hl7-toolkit.sanitized-event.v1', sanitizedText: 'MRN-0001' });
    assert.equal(result.saved, true);
    assert.equal(received.token, 'test-token');
    assert.equal(received.path, '/api/history/events');
    assert.equal(received.payload.sessionId, 'client-session');
    assert.equal(received.payload.event.sanitizedText, 'MRN-0001');
    assert.throws(() => createApi({ token: 'test', sessionId: 'test', baseUrl: 'https://example.com' }), /LOOPBACK_REQUIRED/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
