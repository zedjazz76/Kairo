import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import test from 'node:test';
import { analyzeAck } from '../../hl7-toolkit/app/scripts/ack.mjs';

const message = 'MSH|^~\\&|TOOL|TEST|STUB|TEST|202609031200||ORM^O01|CTRL-77|P|2.5.1\rPID|1||SYNTHETIC-MRN\r';
const ack = (code = 'AA', id = 'CTRL-77') => 'MSH|^~\\&|STUB|TEST|TOOL|TEST|202609031205||ACK^O01|ACK-1|P|2.5.1\rMSA|' + code + '|' + id + '\r';
const profile = (port, overrides = {}) => ({ schema: 'hl7-toolkit.endpoint-profile.v1', id: 'synthetic-loopback', label: 'Synthetic loopback', environment: 'Test', host: '127.0.0.1', port, connectTimeoutMs: 2000, responseTimeoutMs: 300, encoding: 'utf-8', startByte: 11, endBytes: [28, 13], notes: '', ...overrides });

function runPowerShell(script, input) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', "$ErrorActionPreference='Stop'; [Console]::InputEncoding=New-Object Text.UTF8Encoding($false); [Console]::OutputEncoding=New-Object Text.UTF8Encoding($false); " + script], { windowsHide: true });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(JSON.stringify(input));
  });
}

async function callTransport(input, check = false) {
  const result = await runPowerShell("Import-Module './hl7-toolkit/service/HL7Toolkit.Mllp.psm1' -Force -DisableNameChecking; $payload=[Console]::In.ReadToEnd() | ConvertFrom-Json; " +
    (check ? 'Test-HL7Endpoint -Profile $payload.profile' : 'Send-HL7MllpMessage -Profile $payload.profile -Message $payload.message') + ' | ConvertTo-Json -Depth 12 -Compress', input);
  assert.equal(result.code, 0, result.stderr);
  return JSON.parse(result.stdout.trim());
}

async function withServer(onConnection, action) {
  const sockets = new Set();
  const server = net.createServer((socket) => { sockets.add(socket); socket.on('error', (error) => { if (error.code !== 'ECONNRESET') throw error; }); socket.on('close', () => sockets.delete(socket)); onConnection(socket); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { return await action(server.address().port); }
  finally { for (const socket of sockets) socket.destroy(); await new Promise((resolve) => server.close(resolve)); }
}

test('ACK analyzer classifies all six codes and correlates MSA-2', () => {
  const categories = { AA: 'application-accept', AE: 'application-error', AR: 'application-reject', CA: 'commit-accept', CE: 'commit-error', CR: 'commit-reject' };
  for (const [code, category] of Object.entries(categories)) {
    const result = analyzeAck(ack(code), 'CTRL-77');
    assert.equal(result.code, code); assert.equal(result.category, category); assert.equal(result.correlated, true);
  }
  assert.equal(analyzeAck(ack('AA', 'WRONG'), 'CTRL-77').accepted, false);
  assert.equal(analyzeAck(ack('CA'), 'CTRL-77').applicationStatus, 'not-confirmed');
  assert.equal(analyzeAck('not an ACK', 'CTRL-77').valid, false);
});

test('ACK analyzer reads modern ERR location, code, severity, and diagnostic fields', () => {
  const result = analyzeAck(ack('AE') + 'ERR||ORC^1^2^1|101^Required field missing^HL70357|E|||Synthetic diagnostic|Synthetic user message\r', 'CTRL-77');
  assert.equal(result.errors[0].location, 'ORC^1^2^1');
  assert.equal(result.errors[0].code, '101');
  assert.equal(result.errors[0].severity, 'E');
  assert.equal(result.errors[0].diagnostic, 'Synthetic diagnostic');
});

test('MLLP sends one independently verified frame and returns one correlated response without retry', async () => {
  let connections = 0; let received = Buffer.alloc(0); let replied = false;
  await withServer((socket) => {
    connections += 1;
    socket.on('data', (chunk) => {
      received = Buffer.concat([received, chunk]);
      if (!replied && received.includes(Buffer.from([28, 13]))) { replied = true; socket.write(Buffer.concat([Buffer.from([11]), Buffer.from(ack()), Buffer.from([28, 13])])); }
    });
  }, async (port) => {
    const result = await callTransport({ profile: profile(port), message });
    assert.equal(result.status, 'response');
    assert.equal(result.bytesSent, Buffer.byteLength(message) + 3);
    assert.equal(result.deliveryUncertain, false);
    assert.ok(result.latencyMs >= 0);
    assert.equal(analyzeAck(result.response, 'CTRL-77').accepted, true);
  });
  assert.equal(connections, 1);
  assert.equal(received[0], 11);
  assert.deepEqual([...received.subarray(-2)], [28, 13]);
  assert.equal(received.subarray(1, -2).toString(), message);
});

test('timeout after a write is unknown delivery and never triggers a second connection', async () => {
  let connections = 0;
  await withServer((socket) => { connections += 1; socket.on('data', () => {}); }, async (port) => {
    const result = await callTransport({ profile: profile(port), message });
    assert.equal(result.status, 'unknown-delivery');
    assert.equal(result.deliveryUncertain, true);
    assert.ok(result.bytesSent > 0);
  });
  assert.equal(connections, 1);
});

test('malformed response remains uncertain and a connection check transmits no HL7', async () => {
  await withServer((socket) => socket.on('data', () => socket.write('NOT-MLLP')), async (port) => {
    const result = await callTransport({ profile: profile(port), message });
    assert.equal(result.status, 'malformed-response');
    assert.equal(result.deliveryUncertain, true);
  });
  let receivedBytes = 0;
  await withServer((socket) => socket.on('data', (chunk) => { receivedBytes += chunk.length; }), async (port) => {
    const result = await callTransport({ profile: profile(port) }, true);
    assert.equal(result.status, 'reachable');
  });
  assert.equal(receivedBytes, 0);
});

test('multiple messages and unsupported ASCII characters are rejected before any network connection', async () => {
  let connections = 0;
  await withServer(() => { connections += 1; }, async (port) => {
    for (const payload of [{ profile: profile(port), message: message + message }, { profile: profile(port, { encoding: 'ascii' }), message: message + 'NTE|1||Café\r' }]) {
      const result = await runPowerShell("Import-Module './hl7-toolkit/service/HL7Toolkit.Mllp.psm1' -Force -DisableNameChecking; $payload=[Console]::In.ReadToEnd() | ConvertFrom-Json; Send-HL7MllpMessage -Profile $payload.profile -Message $payload.message | ConvertTo-Json -Compress", payload);
      assert.notEqual(result.code, 0);
    }
  });
  assert.equal(connections, 0);
});

test('endpoint profiles persist only the allowlisted nonclinical schema', async () => {
  const dataRoot = mkdtempSync(path.join(tmpdir(), 'hl7-profiles-'));
  try {
    const result = await runPowerShell("Import-Module './hl7-toolkit/service/HL7Toolkit.Profiles.psm1' -Force -DisableNameChecking; $payload=[Console]::In.ReadToEnd() | ConvertFrom-Json; Save-HL7EndpointProfile -DataRoot $payload.dataRoot -Profile $payload.profile | Out-Null; Get-HL7EndpointProfiles -DataRoot $payload.dataRoot | ConvertTo-Json -Depth 10 -Compress", { dataRoot, profile: profile(2575) });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).profiles[0].host, '127.0.0.1');
    const bad = await runPowerShell("Import-Module './hl7-toolkit/service/HL7Toolkit.Profiles.psm1' -Force -DisableNameChecking; $payload=[Console]::In.ReadToEnd() | ConvertFrom-Json; Save-HL7EndpointProfile -DataRoot $payload.dataRoot -Profile $payload.profile", { dataRoot, profile: { ...profile(2575), message: 'RAW-PROFILE-CANARY' } });
    assert.notEqual(bad.code, 0);
    const files = readdirSync(path.join(dataRoot, 'profiles'));
    assert.equal(files.length, 1);
    assert.doesNotMatch(readFileSync(path.join(dataRoot, 'profiles', files[0]), 'utf8'), /RAW-PROFILE-CANARY/);
  } finally {
    assert.ok(path.resolve(dataRoot).startsWith(path.resolve(tmpdir()) + path.sep));
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('custom encoding and framing preserve exact outbound bytes', async () => {
  let received = Buffer.alloc(0);
  await withServer((socket) => socket.on('data', (chunk) => {
    received = Buffer.concat([received, chunk]);
    if (received.at(-1) === 3) socket.write(Buffer.concat([Buffer.from([2]), Buffer.from(ack()), Buffer.from([3])]));
  }), async (port) => {
    const result = await callTransport({ profile: profile(port, { encoding: 'windows-1252', startByte: 2, endBytes: [3] }), message: message + 'NTE|1||Caf\u00e9\r' });
    assert.equal(result.status, 'response');
    assert.equal(received[0], 2); assert.equal(received.at(-1), 3);
    assert.ok(received.includes(Buffer.from([67, 97, 102, 233, 13])));
  });
});

test('refused connection reports no write and no uncertain delivery', async () => {
  let port;
  await withServer(() => {}, async (available) => { port = available; });
  const result = await callTransport({ profile: profile(port), message });
  assert.equal(result.status, 'connect-failed'); assert.equal(result.writeAttempted, false);
  assert.equal(result.bytesSent, 0); assert.equal(result.deliveryUncertain, false);
});
