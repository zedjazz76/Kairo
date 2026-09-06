import assert from 'node:assert/strict';
import test from 'node:test';
import net from 'node:net';
import { startService } from './helpers/service-harness.mjs';

async function listener(onConnection, host = '127.0.0.1') {
  const sockets = new Set();
  const server = net.createServer(socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {}); onConnection(socket); });
  await new Promise(resolve => server.listen(0, host, resolve));
  return { port: server.address().port, async close() { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); } };
}

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
      ['success', 'C_ECHO_SUCCESS', 'echo'], ['fragmented', 'C_ECHO_SUCCESS', 'echo'],
      ['reject', 'ASSOCIATION_REJECTED', 'association'], ['context-rejected', 'VERIFICATION_NOT_ACCEPTED', 'association'],
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
        if (mode === 'reject') { assert.equal(data.rejectionReason, 7); assert.match(data.association.detail, /Called AE/); }
        assert.deepEqual(peer.observations.errors, [], mode);
      } finally { await peer.close(); }
    }
  } finally { await service.stop(); }
});
