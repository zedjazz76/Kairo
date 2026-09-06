import assert from 'node:assert/strict';
import test from 'node:test';
import { makeBaseline, compareBaseline, correlateEvidence } from '../../hl7-toolkit/app/scripts/diagnostic-analysis.mjs';

test('baseline keeps technical evidence only and reports the first meaningful DICOM change', () => {
  const success = { classification: 'C_ECHO_SUCCESS', elapsedMs: 18, dns: { code: 'NOT_REQUIRED' }, tcp: { code: 'TCP_CONNECTED' }, association: { code: 'ASSOCIATION_ACCEPTED' }, echo: { code: 'C_ECHO_SUCCESS' } };
  const baseline = makeBaseline(success, 'dicom', { profileId: 'orthanc', label: 'Orthanc', host: '127.0.0.1', port: 4242 });
  assert.deepEqual(Object.keys(baseline).sort(), ['classification', 'endpoint', 'layers', 'profileId', 'savedAt', 'schema', 'totalMs', 'type'].sort());
  const current = { ...success, classification: 'ASSOCIATION_REJECTED', elapsedMs: 25, association: { code: 'ASSOCIATION_REJECTED' }, echo: { code: 'NOT_RUN' } };
  const changes = compareBaseline(baseline, current);
  assert.match(changes[0], /DICOM association.*ASSOCIATION_ACCEPTED.*ASSOCIATION_REJECTED/);
  assert.ok(!changes.some(change => /DNS|TCP/.test(change)));
});

test('baseline comparison highlights certificate risk and ACK changes without unchanged noise', () => {
  const tls = makeBaseline({ classification: 'HTTP_RESPONSE', elapsedMs: 80, certificateDaysUntilExpiration: 180, tlsVersion: 'Tls12', httpStatus: 200, dns: { code: 'RESOLVED' }, tcp: { code: 'TCP_CONNECTED' }, tls: { code: 'TLS_CONNECTED' }, http: { code: 'HTTP_RESPONSE' } }, 'https', { profileId: 'web', label: 'Web', host: 'example.test', port: 443 });
  const tlsChanges = compareBaseline(tls, { ...tls, certificateDaysUntilExpiration: 12, dns: { code: 'RESOLVED' }, tcp: { code: 'TCP_CONNECTED' }, tls: { code: 'TLS_CONNECTED' }, http: { code: 'HTTP_RESPONSE' } });
  assert.deepEqual(tlsChanges, ['Certificate expiration risk increased: 180 days → 12 days.']);
  const mllp = makeBaseline({ classification: 'APPLICATION_ACCEPT', elapsedMs: 20, acknowledgmentCode: 'AA', dns: { code: 'NOT_REQUIRED' }, tcp: { code: 'TCP_CONNECTED' }, mllp: { code: 'MLLP_MESSAGE_SENT' }, ack: { code: 'ACK_RECEIVED' }, application: { code: 'APPLICATION_ACCEPT' } }, 'mllp', { profileId: 'hl7', label: 'HL7', host: '127.0.0.1', port: 2575 });
  assert.match(compareBaseline(mllp, { ...mllp, acknowledgmentCode: 'AE', dns: { code: 'NOT_REQUIRED' }, tcp: { code: 'TCP_CONNECTED' }, mllp: { code: 'MLLP_MESSAGE_SENT' }, ack: { code: 'ACK_RECEIVED' }, application: { code: 'APPLICATION_ERROR' } }).join(' '), /APPLICATION_ACCEPT.*APPLICATION_ERROR.*AA.*AE/);
});

test('evidence correlation identifies application, association and transport boundaries without overstating certainty', () => {
  const mllp = correlateEvidence({ type: 'mllp', result: { dns: { code: 'NOT_REQUIRED' }, tcp: { code: 'TCP_CONNECTED' }, mllp: { code: 'MLLP_MESSAGE_SENT' }, ack: { code: 'ACK_RECEIVED' }, application: { code: 'APPLICATION_ERROR' }, acknowledgmentCode: 'AE' }, validationSummary: '0 errors · 1 warning · 0 not evaluated.', baselineChanges: [] });
  assert.match(mllp.observed.join(' '), /TCP_CONNECTED.*ACK_RECEIVED.*AE/); assert.match(mllp.likelyBoundary, /application processing/i); assert.match(mllp.missingEvidence, /receiver/i); assert.match(mllp.nextCheck, /MSA.*ERR/i);
  const dicom = correlateEvidence({ type: 'dicom', result: { dns: { code: 'RESOLVED' }, tcp: { code: 'TCP_CONNECTED' }, association: { code: 'ASSOCIATION_REJECTED' }, echo: { code: 'NOT_RUN' } }, validationSummary: '', baselineChanges: ['DICOM association changed: ASSOCIATION_ACCEPTED → ASSOCIATION_REJECTED.'] });
  assert.match(dicom.likelyBoundary, /AE configuration.*association/i); assert.match(dicom.nextCheck, /Called AE.*Calling AE/i); assert.ok(dicom.observed.some(value => /baseline/i.test(value)));
  const network = correlateEvidence({ type: 'tcp', result: { dns: { code: 'RESOLVED' }, tcp: { code: 'CONNECTION_REFUSED' } }, validationSummary: '', baselineChanges: [] });
  assert.match(network.likelyBoundary, /TCP listener.*network policy/i); assert.match(network.missingEvidence, /service/i);
});
