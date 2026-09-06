const ORDER = {
  tcp: [['dns', 'DNS'], ['tcp', 'TCP']],
  dicom: [['dns', 'DNS'], ['tcp', 'TCP'], ['association', 'DICOM association'], ['echo', 'C-ECHO']],
  http: [['dns', 'DNS'], ['tcp', 'TCP'], ['tls', 'TLS'], ['http', 'HTTP']],
  https: [['dns', 'DNS'], ['tcp', 'TCP'], ['tls', 'TLS'], ['http', 'HTTP']],
  mllp: [['dns', 'DNS'], ['tcp', 'TCP'], ['mllp', 'MLLP message'], ['ack', 'ACK'], ['application', 'HL7 application']],
};

export function makeBaseline(result, type, identity) {
  const layers = {};
  for (const [key] of ORDER[type] || []) layers[key] = { code: result[key]?.code || 'NOT_RUN', elapsedMs: Number(result[key]?.elapsedMs) || 0 };
  const baseline = { schema: 'kairo.diagnostic-baseline.v1', profileId: identity.profileId, type, endpoint: { label: identity.label, host: identity.host, port: Number(identity.port) }, savedAt: new Date().toISOString(), classification: result.classification || 'UNKNOWN', totalMs: Number(result.elapsedMs) || 0, layers };
  if (type === 'http' || type === 'https') { baseline.certificateDaysUntilExpiration = result.certificateDaysUntilExpiration ?? null; baseline.tlsVersion = result.tlsVersion || ''; baseline.httpStatus = Number(result.httpStatus) || 0; }
  if (type === 'mllp') baseline.acknowledgmentCode = result.acknowledgmentCode || '';
  return baseline;
}

export function compareBaseline(baseline, current) {
  if (!baseline) return ['No saved baseline is available for this profile.'];
  const changes = [];
  for (const [key, label] of ORDER[baseline.type] || []) {
    const before = baseline.layers?.[key]?.code || 'NOT_RUN', after = current[key]?.code || 'NOT_RUN';
    if (before !== after) { changes.push(`${label} changed: ${before} → ${after}.`); break; }
  }
  if ((baseline.type === 'http' || baseline.type === 'https') && baseline.certificateDaysUntilExpiration !== null && current.certificateDaysUntilExpiration !== null && current.certificateDaysUntilExpiration !== undefined && current.certificateDaysUntilExpiration < baseline.certificateDaysUntilExpiration && current.certificateDaysUntilExpiration <= 30) changes.push(`Certificate expiration risk increased: ${baseline.certificateDaysUntilExpiration} days → ${current.certificateDaysUntilExpiration} days.`);
  if (baseline.type === 'mllp' && baseline.acknowledgmentCode !== (current.acknowledgmentCode || '')) changes.push(`MSA acknowledgment changed: ${baseline.acknowledgmentCode || 'none'} → ${current.acknowledgmentCode || 'none'}.`);
  const currentMs = Number(current.elapsedMs) || 0;
  if (baseline.totalMs > 0 && currentMs - baseline.totalMs >= Math.max(50, baseline.totalMs * 0.5)) changes.push(`Total time increased: ${baseline.totalMs} ms → ${currentMs} ms.`);
  return changes.length ? changes : ['No meaningful change from the saved baseline.'];
}

export function correlateEvidence({ type, result, validationSummary = '', dicomEvidence = false, baselineChanges = [] }) {
  const observed = [];
  for (const [key, label] of ORDER[type] || []) { const code = result?.[key]?.code; if (code && code !== 'NOT_RUN') observed.push(`${label}: ${code}.`); }
  if (result?.acknowledgmentCode) observed.push(`MSA-1: ${result.acknowledgmentCode}.`);
  if (/\d+ errors? · \d+ warnings?/i.test(validationSummary)) observed.push(`HL7 validation summary: ${validationSummary}`);
  if (dicomEvidence) observed.push('DICOM metadata inspection evidence is available in this session.');
  for (const change of baselineChanges) if (!/^No meaningful|^No saved/.test(change)) observed.push(`Baseline comparison: ${change}`);
  let likelyBoundary = 'The available evidence does not yet isolate a troubleshooting boundary.';
  let missingEvidence = 'Application-specific evidence beyond endpoint reachability is still needed.';
  let nextCheck = 'Run the smallest protocol-specific diagnostic for the affected workflow.';
  const code = key => result?.[key]?.code || 'NOT_RUN';
  if (code('dns') === 'DNS_FAILED' || code('dns') === 'DNS_TIMEOUT') { likelyBoundary = 'DNS naming or resolution is the best-supported boundary.'; missingEvidence = 'A resolvable authorized hostname or confirmed destination IP is missing.'; nextCheck = 'Confirm the exact configured hostname with the endpoint owner.'; }
  else if (['CONNECTION_REFUSED', 'TIMEOUT', 'UNREACHABLE', 'NETWORK_ERROR'].includes(code('tcp'))) { likelyBoundary = 'The TCP listener or network policy/path is the best-supported boundary.'; missingEvidence = 'Listener state and approved network-policy evidence from the destination service are missing.'; nextCheck = 'Confirm the service is listening on this exact host and port.'; }
  else if (code('association') === 'ASSOCIATION_REJECTED') { likelyBoundary = 'AE configuration or the DICOM association layer is the best-supported boundary.'; missingEvidence = 'The receiver’s configured Called/Calling AE policy and rejection log are missing.'; nextCheck = 'Verify the exact Called AE, Calling AE, and receiver allowlist.'; }
  else if (code('echo') === 'C_ECHO_SUCCESS') { likelyBoundary = 'DNS, TCP, DICOM association, and Verification succeeded; any remaining issue is likely above basic DICOM connectivity.'; missingEvidence = 'Workflow-specific evidence such as storage, query/retrieve, or MWL generation/filtering is missing.'; nextCheck = 'Test only the affected DICOM service or inspect its receiver-side workflow evidence.'; }
  else if (code('tls').startsWith('TLS_CERTIFICATE_')) { likelyBoundary = 'TLS certificate identity, validity, or trust is the best-supported boundary.'; missingEvidence = 'The endpoint certificate deployment and Windows trust-chain evidence are missing.'; nextCheck = 'Review the displayed certificate classification with the endpoint owner.'; }
  else if (code('http') === 'HTTP_RESPONSE') { likelyBoundary = 'DNS, TCP, TLS when applicable, and HTTP response succeeded; any remaining issue is at the HTTP application or workflow layer.'; missingEvidence = 'Application-specific response semantics and server-side evidence are missing.'; nextCheck = 'Review the HTTP status and the endpoint application log for this request time.'; }
  else if (code('application') === 'APPLICATION_ERROR' || code('application') === 'APPLICATION_REJECT') { likelyBoundary = 'HL7 application processing, rather than transport, is the best-supported boundary.'; missingEvidence = 'Receiver-side validation or routing evidence is missing.'; nextCheck = 'Review the correlated MSA and ERR details in the receiver log.'; }
  else if (code('application') === 'APPLICATION_ACCEPT') { likelyBoundary = 'The receiver accepted the correlated synthetic message; any remaining issue is downstream of initial HL7 acceptance.'; missingEvidence = 'Downstream routing, transformation, and target-system processing evidence are missing.'; nextCheck = 'Trace the correlated control ID through the receiver’s next route.'; }
  return { observed: observed.length ? observed : ['No diagnostic result is available.'], likelyBoundary, missingEvidence, nextCheck };
}
