import assert from 'node:assert/strict';
import test from 'node:test';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startService } from './helpers/service-harness.mjs';

async function listener(onConnection, host = '127.0.0.1') {
  const sockets = new Set();
  const server = net.createServer(socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {}); onConnection(socket); });
  await new Promise(resolve => server.listen(0, host, resolve));
  return { port: server.address().port, async close() { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); } };
}

async function httpListener(handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { port: server.address().port, close: () => new Promise(resolve => server.close(resolve)) };
}

test('HTTP diagnostic returns separate layers and one header-only response without following redirects', async () => {
  const service = await startService();
  let requests = 0;
  const peer = await httpListener((request, response) => {
    requests += 1;
    assert.equal(request.method, 'GET');
    assert.equal(request.url, '/health?source=kairo');
    response.writeHead(302, { Location: '/ready', 'Content-Type': 'text/plain', 'Content-Length': '22', 'X-Private-Diagnostic': 'omit' });
    response.end('body-must-not-be-stored');
  });
  try {
    const result = await service.request('/api/diagnostics/run', { method: 'POST', body: { mode: 'http', target: `http://localhost:${peer.port}/health?source=kairo`, timeoutMs: 1000 } });
    assert.equal(result.status, 200);
    assert.equal(result.data.classification, 'HTTP_RESPONSE');
    assert.equal(result.data.dns.code, 'RESOLVED');
    assert.equal(result.data.tcp.code, 'TCP_CONNECTED');
    assert.equal(result.data.tlsTargetHost, 'localhost');
    assert.equal(result.data.httpHost, `localhost:${peer.port}`);
    assert.equal(result.data.tls.code, 'NOT_REQUIRED');
    assert.equal(result.data.http.code, 'HTTP_RESPONSE');
    assert.equal(result.data.httpStatus, 302);
    assert.equal(result.data.redirectLocation, '/ready');
    assert.equal(result.data.redirectFollowed, false);
    assert.deepEqual(result.data.headers, { 'content-length': '22', 'content-type': 'text/plain', location: '/ready' });
    assert.equal('responseBody' in result.data, false);
    assert.equal(requests, 1);
    for (const target of ['ftp://127.0.0.1/', 'http://*.example/', 'http://127.0.0.1/a#fragment', 'http://127.0.0.1 user']) {
      assert.equal((await service.request('/api/diagnostics/run', { method: 'POST', body: { mode: 'http', target, timeoutMs: 300 } })).status, 400);
    }
  } finally { await peer.close(); await service.stop(); }
});

test('HTTPS preserves the URI host for TLS and leaves hostname validation unavailable when no certificate arrives', async () => {
  const service = await startService();
  const peer = await listener(socket => socket.destroy());
  try {
    for (const host of ['localhost', '127.0.0.1']) {
      const result = await service.request('/api/diagnostics/run', { method: 'POST', body: { mode: 'http', target: `https://${host}:${peer.port}/`, timeoutMs: 500 } });
      assert.equal(result.status, 200);
      assert.equal(result.data.tcp.code, 'TCP_CONNECTED');
      assert.equal(result.data.tlsTargetHost, host);
      assert.equal(result.data.httpHost, `${host}:${peer.port}`);
      assert.equal(result.data.tls.code, 'TLS_HANDSHAKE_FAILED');
      assert.equal(result.data.hostnameValidation, 'NOT_AVAILABLE');
      assert.equal(result.data.certificateSubject, '');
      assert.equal(result.data.http.state, 'NOT_RUN');
    }
  } finally { await peer.close(); await service.stop(); }
});

test('HTTPS classifies a received certificate hostname mismatch and does not send HTTP', async () => {
  const certificateRoot = mkdtempSync(path.join(tmpdir(), 'kairo-tls-'));
  const keyPath = path.join(certificateRoot, 'key.pem'); const certificatePath = path.join(certificateRoot, 'certificate.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', keyPath, '-out', certificatePath, '-days', '2', '-nodes', '-subj', '/CN=wrong.example', '-addext', 'subjectAltName=DNS:wrong.example'], { stdio: 'ignore' });
  let requests = 0; const peer = https.createServer({ key: readFileSync(keyPath), cert: readFileSync(certificatePath) }, (_request, response) => { requests += 1; response.end(); });
  await new Promise(resolve => peer.listen(0, '127.0.0.1', resolve)); const service = await startService();
  try {
    const result = await service.request('/api/diagnostics/run', { method: 'POST', body: { mode: 'http', target: `https://localhost:${peer.address().port}/`, timeoutMs: 1000 } });
    assert.equal(result.data.tls.code, 'TLS_CERTIFICATE_HOSTNAME_MISMATCH');
    assert.equal(result.data.hostnameValidation, 'MISMATCH');
    assert.match(result.data.certificateSubject, /CN=wrong\.example/);
    assert.equal(result.data.http.state, 'NOT_RUN'); assert.equal(requests, 0);
  } finally { await service.stop(); await new Promise(resolve => peer.close(resolve)); rmSync(certificateRoot, { recursive: true, force: true }); }
});

test('authenticated TCP diagnostics classify real connections and reject invalid requests', async () => {
  const service = await startService();
  let bytes = 0;
  const peer = await listener(socket => socket.on('data', data => { bytes += data.length; }));
  const run = body => service.request('/api/diagnostics/run', { method: 'POST', body });
  const input = { mode: 'tcp', host: '127.0.0.1', port: peer.port, timeoutMs: 300 };
  try {
    assert.equal((await service.request('/api/diagnostics/run', { method: 'POST', body: input, headers: { 'X-HL7-Token': 'wrong' } })).status, 403);
    const result = await run(input);
    assert.equal(result.status, 200);
    assert.equal(result.data.classification, 'TCP_CONNECTED');
    assert.equal(result.data.dns.code, 'NOT_REQUIRED');
    assert.equal(result.data.tcp.state, 'SUCCESS');
    assert.equal(result.data.association.state, 'NOT_RUN');
    assert.equal(result.data.echo.state, 'NOT_RUN');
    assert.equal(result.data.resolvedAddress, '127.0.0.1');
    assert.ok(result.data.tcp.elapsedMs >= 0);
    assert.ok(Date.parse(result.data.timestamp));
    assert.equal(bytes, 0);
    const dns = await run({ ...input, host: 'localhost' });
    assert.equal(dns.data.dns.code, 'RESOLVED');
    assert.equal(dns.data.classification, 'TCP_CONNECTED');
    for (const patch of [{ host: '*.example' }, { host: '127.0.0.1/24' }, { port: 0 }, { port: [peer.port] }, { timeoutMs: 10001 }, { mode: 'scan' }, { mode: 'dicom', callingAe: 'TOO_LONG_AE_TITLE_123', calledAe: 'TEST' }]) {
      assert.equal((await run({ ...input, ...patch })).status, 400);
    }
    assert.equal((await run([input])).status, 400);
    await peer.close();
    const timed = await run({ ...input, timeoutMs: 100 });
    assert.ok(['TIMEOUT', 'CONNECTION_REFUSED'].includes(timed.data.classification));
    const refused = await run({ ...input, timeoutMs: 3000 });
    assert.equal(refused.data.classification, 'CONNECTION_REFUSED');
    assert.equal(refused.data.tcp.state, 'FAILED');
    assert.equal(refused.data.echo.state, 'NOT_RUN');
    const failedDns = await run({ ...input, host: 'kairo-test-does-not-exist.invalid', timeoutMs: 1000 });
    assert.ok(['DNS_FAILED', 'DNS_TIMEOUT'].includes(failedDns.data.classification));
    assert.equal(failedDns.data.tcp.state, 'NOT_RUN');
  } finally { if (peer) { try { await peer.close(); } catch {} } await service.stop(); }
});

test('MLLP diagnostics separate zero-byte reachability from one synthetic send and correlated AA AE AR acknowledgments', async () => {
  const service = await startService(); const run = body => service.request('/api/diagnostics/run', { method: 'POST', body });
  let reachabilityBytes = 0;
  const reachabilityPeer = await listener(socket => socket.on('data', data => { reachabilityBytes += data.length; }));
  try {
    const reachable = await run({ mode: 'mllp', host: '127.0.0.1', port: reachabilityPeer.port, timeoutMs: 500 });
    assert.equal(reachable.data.classification, 'TCP_CONNECTED'); assert.equal(reachable.data.tcp.code, 'TCP_CONNECTED');
    assert.equal(reachable.data.mllp.code, 'MLLP_NOT_VERIFIED'); assert.equal(reachable.data.mllp.state, 'INDETERMINATE'); assert.equal(reachabilityBytes, 0);
    await reachabilityPeer.close();
    for (const [ackCode, expected] of [['AA', 'APPLICATION_ACCEPT'], ['AE', 'APPLICATION_ERROR'], ['AR', 'APPLICATION_REJECT']]) {
      let connections = 0; let sent = Buffer.alloc(0);
      const peer = await listener(socket => { connections += 1; socket.on('data', data => {
        sent = Buffer.concat([sent, data]); if (!sent.subarray(-2).equals(Buffer.from([0x1c, 0x0d]))) return;
        assert.equal(sent[0], 0x0b); const message = sent.subarray(1, -2).toString('utf8'); const controlId = message.split('\r')[0].split('|')[9];
        const err = ackCode === 'AE' ? 'ERR||PID^3^1|101^Synthetic ID rejected^HL70357|E|||Synthetic diagnostic|Synthetic user message\r' : '';
        socket.end(`\x0bMSH|^~\\&|SYNTHETIC_RECEIVER|TEST|KAIRO_SYNTHETIC|KAIRO_TEST|20260906120000||ACK^A01|ACK-${controlId}|P|2.5\rMSA|${ackCode}|${controlId}|Synthetic ${ackCode} result\r${err}\x1c\r`);
      }); });
      try {
        const result = await run({ mode: 'mllp-synthetic', host: '127.0.0.1', port: peer.port, timeoutMs: 1000 });
        assert.equal(result.data.tcp.code, 'TCP_CONNECTED'); assert.equal(result.data.mllp.code, 'MLLP_MESSAGE_SENT'); assert.equal(result.data.ack.code, 'ACK_RECEIVED');
        assert.equal(result.data.application.code, expected); assert.equal(result.data.acknowledgmentCode, ackCode); assert.equal(result.data.acknowledgedControlId, result.data.messageControlId); assert.equal(result.data.controlIdCorrelated, true);
        assert.match(result.data.acknowledgmentText, new RegExp(`Synthetic ${ackCode}`)); if (ackCode === 'AE') assert.match(result.data.acknowledgmentError, /Synthetic diagnostic/);
        assert.match(sent.toString('utf8'), /KAIRO-SYNTHETIC-TEST-ID.*TEST\^PATIENT/); assert.equal(connections, 1);
      } finally { await peer.close(); }
    }
    const silentPeer = await listener(() => {});
    try {
      const missing = await run({ mode: 'mllp-synthetic', host: '127.0.0.1', port: silentPeer.port, timeoutMs: 100 });
      assert.equal(missing.data.mllp.code, 'MLLP_MESSAGE_SENT'); assert.equal(missing.data.ack.code, 'ACK_TIMEOUT'); assert.equal(missing.data.application.state, 'NOT_RUN');
    } finally { await silentPeer.close(); }
  } finally { try { await reachabilityPeer.close(); } catch {} await service.stop(); }
});

import { startDicomPeer } from './helpers/dicom-peer.mjs';
test('blocked diagnostic compilation preserves the existing launcher and reports unavailability', async () => {
  const service = await startService({ launcher: 'tests/hl7-toolkit/helpers/diagnostics-policy-block.ps1' });
  try {
    assert.equal((await service.request('/api/session')).status, 200);
    const response = await service.request('/api/diagnostics/run', { method: 'POST', body: { mode: 'tcp', host: '127.0.0.1', port: 104 } });
    assert.equal(response.status, 503);
    assert.equal(response.data.error, 'DIAGNOSTIC_RUNTIME_UNAVAILABLE');
    assert.equal((await service.request('/api/profiles/endpoint')).status, 200);
  } finally { await service.stop(); }
});
test('DICOM Verification preserves layer evidence across success, negotiation and DIMSE failures', async () => {
  const service = await startService();
  try {
    for (const [mode, expected, layer] of [
      ['success', 'C_ECHO_SUCCESS', 'echo'], ['fragmented', 'C_ECHO_SUCCESS', 'echo'], ['fragmented-association', 'C_ECHO_SUCCESS', 'echo'],
      ['reject', 'ASSOCIATION_REJECTED', 'association'], ['fragmented-reject', 'ASSOCIATION_REJECTED', 'association'], ['context-rejected', 'VERIFICATION_NOT_ACCEPTED', 'association'],
      ['wrong-syntax', 'NEGOTIATION_MISMATCH', 'association'], ['abort', 'PEER_ABORT', 'association'],
      ['association-timeout', 'TIMEOUT', 'association'], ['malformed', 'MALFORMED_RESPONSE', 'association'],
      ['oversized', 'RESPONSE_TOO_LARGE', 'association'], ['echo-timeout', 'TIMEOUT', 'echo'],
      ['wrong-id', 'RESPONSE_MISMATCH', 'echo'], ['wrong-command', 'RESPONSE_MISMATCH', 'echo'],
      ['wrong-context', 'RESPONSE_MISMATCH', 'echo'], ['echo-failed', 'C_ECHO_FAILED', 'echo'], ['incomplete', 'INCOMPLETE_RESPONSE', 'echo'],
    ]) {
      const peer = await startDicomPeer(mode);
      try {
        const { status, data } = await service.request('/api/diagnostics/run', { method: 'POST', body: { mode: 'dicom', host: '127.0.0.1', port: peer.port, callingAe: 'KAIRO', calledAe: 'TEST_SCP', timeoutMs: 400 } });
        assert.equal(status, 200, mode);
        assert.equal(data.tcp.state, 'SUCCESS', mode);
        assert.equal(data.classification, expected, mode);
        assert.equal(data[layer].code, expected, mode);
        if (layer === 'association') assert.equal(data.echo.state, 'NOT_RUN', mode);
        else assert.equal(data.association.code, 'ASSOCIATION_ACCEPTED', mode);
        if (expected === 'C_ECHO_SUCCESS') { assert.equal(data.echoStatus, '0000'); assert.ok(peer.observations.released); }
        if (mode === 'reject' || mode === 'fragmented-reject') { assert.equal(data.rejectionReason, 7); assert.match(data.association.detail, /Called AE/); }
        assert.deepEqual(peer.observations.errors, [], mode);
      } finally { await peer.close(); }
    }
  } finally { await service.stop(); }
});
