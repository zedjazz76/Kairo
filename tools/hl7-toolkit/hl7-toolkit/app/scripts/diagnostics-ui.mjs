import { makeBaseline, compareBaseline, correlateEvidence } from './diagnostic-analysis.mjs';

export function mountDiagnostics(root, api) {
  const $ = selector => root.querySelector(selector);
  const layers = [['dns', 'DNS'], ['tcp', 'TCP'], ['association', 'DICOM association'], ['echo', 'C-ECHO']];
  let busy = false;
  let lastDiagnostic = null, loadedBaseline = null, lastComparison = [];
  const recordDiagnostic = (type, result) => { lastDiagnostic = { type, result }; if (loadedBaseline && loadedBaseline.type === type) { lastComparison = compareBaseline(loadedBaseline, result); $('#diagnostic-baseline-comparison').textContent = lastComparison.join(' '); } };
  const controls = ['host', 'port', 'timeout', 'calling', 'called', 'tcp', 'echo'];
  const reset = () => { for (const [id, label] of layers) $('#diagnostic-layer-' + id).textContent = label + ': NOT_RUN'; };
  reset();
  $('#diagnostic-form').addEventListener('submit', event => event.preventDefault());
  async function run(mode) {
    if (busy || !$('#diagnostic-form').reportValidity()) return;
    const body = { mode, host: $('#diagnostic-host').value.trim(), port: Number($('#diagnostic-port').value), timeoutMs: Number($('#diagnostic-timeout').value) };
    if (mode === 'dicom') { body.callingAe = $('#diagnostic-calling').value.trim(); body.calledAe = $('#diagnostic-called').value.trim(); }
    busy = true;
    controls.forEach(id => { $('#diagnostic-' + id).disabled = true; });
    reset();
    $('#diagnostic-result').textContent = 'Testing ' + body.host + ':' + body.port + (mode === 'dicom' ? ' with DICOM Verification only…' : ' with a TCP connection only…');
    try {
      const result = await api.request('/api/diagnostics/run', { method: 'POST', body });
      recordDiagnostic(mode, result);
      $('#diagnostic-result').textContent = result.classification + ' · ' + result.host + ':' + result.port + ' · Address: ' + (result.resolvedAddress || 'not resolved') + ' · ' + result.elapsedMs + ' ms total · ' + result.timestamp;
      for (const [id, label] of layers) {
        const layer = result[id];
        $('#diagnostic-layer-' + id).textContent = label + ': ' + layer.state + ' · ' + layer.code + ' · ' + layer.elapsedMs + ' ms — ' + layer.detail;
      }
      if (result.release === 'UNCONFIRMED') $('#diagnostic-result').textContent += ' · Association release unconfirmed; the socket was closed.';
    } catch (error) {
      const detail = error.message === 'DIAGNOSTIC_RUNTIME_UNAVAILABLE' ? 'Endpoint diagnostics are unavailable under the current runtime policy. Existing tools remain available; no workstation policy was changed.' : error.message === 'DIAGNOSTIC_AE_REJECTED' ? 'Enter Calling and Called AE titles of 1–16 printable characters, without backslashes.' : 'Check the entered host, port, timeout and AE titles, and confirm the local helper is running.';
      $('#diagnostic-result').textContent = 'Diagnostic request failed. ' + detail + ' No successful endpoint result is available. Retry only when ready.';
      reset();
    } finally {
      busy = false;
      controls.forEach(id => { $('#diagnostic-' + id).disabled = false; });
    }
  }
  $('#diagnostic-tcp').addEventListener('click', () => run('tcp'));
  $('#diagnostic-echo').addEventListener('click', () => run('dicom'));
  const httpLayers = [['dns', 'DNS'], ['tcp', 'TCP'], ['tls', 'TLS'], ['http', 'HTTP']];
  const resetHttp = () => { for (const [id, label] of httpLayers) $('#diagnostic-http-layer-' + id).textContent = label + ': NOT_RUN'; $('#diagnostic-http-certificate').textContent = 'Certificate: NOT_AVAILABLE'; $('#diagnostic-http-tls-evidence').textContent = 'TLS evidence: NOT_AVAILABLE'; $('#diagnostic-http-response').textContent = 'HTTP evidence: NOT_AVAILABLE'; };
  resetHttp(); $('#diagnostic-http-form').addEventListener('submit', event => event.preventDefault());
  $('#diagnostic-http-run').addEventListener('click', async () => {
    if (busy || !$('#diagnostic-http-form').reportValidity()) return;
    const body = { mode: 'http', target: $('#diagnostic-http-target').value.trim(), timeoutMs: Number($('#diagnostic-http-timeout').value) };
    busy = true; for (const id of ['target', 'timeout', 'run']) $('#diagnostic-http-' + id).disabled = true; resetHttp(); $('#diagnostic-http-summary').textContent = 'Testing ' + body.target + ' with one request…';
    try {
      const result = await api.request('/api/diagnostics/run', { method: 'POST', body });
      recordDiagnostic(result.scheme || 'http', result);
      $('#diagnostic-http-summary').textContent = result.classification + ' · HTTP status: ' + (result.httpStatus || 'not received') + ' · ' + result.host + ':' + result.port + ' · Address: ' + (result.resolvedAddress || 'not resolved') + ' · ' + result.elapsedMs + ' ms total · ' + result.timestamp;
      for (const [id, label] of httpLayers) { const layer = result[id]; $('#diagnostic-http-layer-' + id).textContent = label + ': ' + layer.state + ' · ' + layer.code + ' · ' + layer.elapsedMs + ' ms — ' + layer.detail; }
      const hostname = result.hostnameValidation === 'VALID' ? 'YES' : result.hostnameValidation === 'MISMATCH' ? 'NO' : 'NOT_AVAILABLE';
      const certificate = [result.certificateSubject && 'Subject: ' + result.certificateSubject, result.certificateIssuer && 'Issuer: ' + result.certificateIssuer, result.certificateValidFrom && 'Valid from: ' + result.certificateValidFrom, result.certificateValidTo && 'Expires: ' + result.certificateValidTo, result.certificateDaysUntilExpiration !== null && result.certificateDaysUntilExpiration !== undefined && 'Days remaining: ' + result.certificateDaysUntilExpiration, result.tlsVersion && 'TLS: ' + result.tlsVersion, result.scheme === 'https' && 'Hostname valid: ' + hostname].filter(Boolean);
      $('#diagnostic-http-certificate').textContent = 'Certificate: ' + (certificate.length ? certificate.join(' · ') : 'NOT_AVAILABLE');
      $('#diagnostic-http-tls-evidence').textContent = 'TLS evidence: TargetHost ' + (result.tlsTargetHost || 'NOT_AVAILABLE') + ' · Certificate received: ' + (result.certificateReceived ? 'YES' : 'NO') + ' · Policy: ' + (result.tlsPolicyErrors || 'NOT_AVAILABLE') + ' · Chain: ' + (result.chainStatus || 'NOT_AVAILABLE') + ' · Chain valid: ' + (result.chainValidation || 'NOT_AVAILABLE') + (result.exceptionType ? ' · Exception: ' + result.exceptionType : '') + (result.innerExceptionType ? ' · Inner: ' + result.innerExceptionType : '');
      const headers = Object.entries(result.headers || {}).map(([name, value]) => name + ': ' + value); $('#diagnostic-http-response').textContent = 'HTTP evidence: ' + (result.redirectLocation ? 'Redirect (not followed): ' + result.redirectLocation : 'Redirect: none reported') + (headers.length ? ' · ' + headers.join(' · ') : ' · No selected headers returned');
    } catch { $('#diagnostic-http-summary').textContent = 'HTTP / TLS diagnostic request failed. Check the URL and timeout, and confirm the local helper is running.'; resetHttp(); }
    finally { busy = false; for (const id of ['target', 'timeout', 'run']) $('#diagnostic-http-' + id).disabled = false; }
  });
  const mllpLayers = [['dns', 'DNS'], ['tcp', 'TCP'], ['mllp', 'MLLP message'], ['ack', 'ACK'], ['application', 'Application']]; const mllpControls = ['host', 'port', 'timeout', 'check', 'send'];
  const resetMllp = () => { for (const [id, label] of mllpLayers) $('#diagnostic-mllp-layer-' + id).textContent = label + ': NOT_RUN'; $('#diagnostic-mllp-ack').textContent = 'ACK evidence: NOT_AVAILABLE'; };
  const showDestination = () => { const host = $('#diagnostic-mllp-host').value.trim(), port = $('#diagnostic-mllp-port').value; $('#diagnostic-mllp-destination').textContent = host && port ? 'Destination: ' + host + ':' + port + '. Verify this exact endpoint before either action.' : 'Destination: enter a host and port.'; };
  resetMllp(); showDestination(); $('#diagnostic-mllp-form').addEventListener('submit', event => event.preventDefault()); $('#diagnostic-mllp-host').addEventListener('input', showDestination); $('#diagnostic-mllp-port').addEventListener('input', showDestination);
  async function runMllp(mode) {
    if (busy || !$('#diagnostic-mllp-form').reportValidity()) return;
    const body = { mode, host: $('#diagnostic-mllp-host').value.trim(), port: Number($('#diagnostic-mllp-port').value), timeoutMs: Number($('#diagnostic-mllp-timeout').value) };
    busy = true; mllpControls.forEach(id => { $('#diagnostic-mllp-' + id).disabled = true; }); resetMllp();
    $('#diagnostic-mllp-summary').textContent = mode === 'mllp' ? 'Opening one zero-payload connection to ' + body.host + ':' + body.port + '…' : 'Sending one generated synthetic message to ' + body.host + ':' + body.port + '…';
    try {
      const result = await api.request('/api/diagnostics/run', { method: 'POST', body });
      recordDiagnostic('mllp', result);
      $('#diagnostic-mllp-summary').textContent = result.classification + ' · ' + result.host + ':' + result.port + ' · Address: ' + (result.resolvedAddress || 'not resolved') + ' · ' + result.elapsedMs + ' ms total · ' + result.timestamp;
      for (const [id, label] of mllpLayers) { const layer = result[id]; $('#diagnostic-mllp-layer-' + id).textContent = label + ': ' + layer.state + ' · ' + layer.code + ' · ' + layer.elapsedMs + ' ms — ' + layer.detail; }
      if (result.acknowledgmentCode) $('#diagnostic-mllp-ack').textContent = 'ACK evidence: MSA-1 ' + result.acknowledgmentCode + ' · sent MSH-10 ' + result.messageControlId + ' · returned MSA-2 ' + result.acknowledgedControlId + ' · ' + (result.controlIdCorrelated ? 'correlated' : 'NOT CORRELATED') + (result.acknowledgmentText ? ' · MSA text: ' + result.acknowledgmentText : '') + (result.acknowledgmentError ? ' · ERR: ' + result.acknowledgmentError : '');
    } catch { $('#diagnostic-mllp-summary').textContent = 'HL7 / MLLP diagnostic request failed. Check the host, port and timeout, and confirm the local helper is running.'; resetMllp(); }
    finally { busy = false; mllpControls.forEach(id => { $('#diagnostic-mllp-' + id).disabled = false; }); }
  }
  $('#diagnostic-mllp-check').addEventListener('click', () => runMllp('mllp')); $('#diagnostic-mllp-send').addEventListener('click', () => runMllp('mllp-synthetic'));
  let profiles = [];
  const profileFields = ['name', 'type', 'host', 'port', 'calling', 'called', 'environment', 'notes'];
  const profileValue = id => $('#diagnostic-profile-' + id).value;
  const fillProfile = profile => {
    if (!profile) return;
    for (const [id, key] of [['name', 'label'], ['type', 'type'], ['host', 'host'], ['port', 'port'], ['calling', 'callingAe'], ['called', 'calledAe'], ['environment', 'environment'], ['notes', 'notes']]) $('#diagnostic-profile-' + id).value = profile[key] ?? '';
    if (profile.type === 'http' || profile.type === 'https') { $('#diagnostic-http-target').value = profile.type + '://' + profile.host + (profile.port === (profile.type === 'https' ? 443 : 80) ? '' : ':' + profile.port); }
    else if (profile.type === 'mllp') { $('#diagnostic-mllp-host').value = profile.host; $('#diagnostic-mllp-port').value = profile.port; showDestination(); }
    else { $('#diagnostic-host').value = profile.host; $('#diagnostic-port').value = profile.port; if (profile.type === 'dicom') { $('#diagnostic-calling').value = profile.callingAe || ''; $('#diagnostic-called').value = profile.calledAe || ''; } }
    $('#diagnostic-profile-status').textContent = 'Selected profile filled the matching diagnostic controls. Choose the diagnostic action explicitly.';
  };
  async function loadProfiles(selected = '') {
    const result = await api.request('/api/profiles/endpoint'); profiles = result.profiles || []; const select = $('#diagnostic-profile-select'); const options = [];
    const blank = root.createElement('option'); blank.value = ''; blank.textContent = 'New profile'; options.push(blank);
    for (const profile of profiles) { const option = root.createElement('option'); option.value = profile.id; option.textContent = profile.label + ' · ' + (profile.type || 'mllp').toUpperCase(); options.push(option); }
    select.replaceChildren(...options); select.value = selected; $('#diagnostic-profile-status').textContent = 'Loaded ' + profiles.length + ' local profile' + (profiles.length === 1 ? '.' : 's.');
  }
  $('#diagnostic-profile-form').addEventListener('submit', event => event.preventDefault());
  $('#diagnostic-profile-load').addEventListener('click', () => loadProfiles());
  $('#diagnostic-profile-select').addEventListener('change', () => fillProfile(profiles.find(profile => profile.id === $('#diagnostic-profile-select').value)));
  $('#diagnostic-profile-save').addEventListener('click', async () => {
    if (!$('#diagnostic-profile-form').reportValidity()) return; const existing = $('#diagnostic-profile-select').value;
    const profile = { schema: 'hl7-toolkit.endpoint-profile.v1', id: existing || 'diagnostic-' + Date.now().toString(36), label: profileValue('name').trim(), environment: profileValue('environment'), type: profileValue('type'), host: profileValue('host').trim(), port: Number(profileValue('port')), callingAe: profileValue('calling').trim(), calledAe: profileValue('called').trim(), connectTimeoutMs: 3000, responseTimeoutMs: 3000, encoding: 'utf-8', startByte: 11, endBytes: [28, 13], notes: profileValue('notes').trim() };
    const saved = await api.request('/api/profiles/endpoint', { method: 'POST', body: { profile } }); await loadProfiles(saved.id); fillProfile(saved); $('#diagnostic-profile-status').textContent = 'Endpoint profile saved locally.';
  });
  $('#diagnostic-profile-delete').addEventListener('click', async () => { const id = $('#diagnostic-profile-select').value; if (!id) return; await api.request('/api/profiles/endpoint', { method: 'DELETE', body: { id } }); profiles = profiles.filter(profile => profile.id !== id); await loadProfiles(); $('#diagnostic-profile-status').textContent = 'Selected endpoint profile deleted.'; });
  $('#diagnostic-baseline-save').addEventListener('click', async () => {
    const profile = profiles.find(item => item.id === $('#diagnostic-profile-select').value); if (!profile || !lastDiagnostic || profile.type !== lastDiagnostic.type) { $('#diagnostic-baseline-status').textContent = 'Select the matching endpoint profile and run its diagnostic first.'; return; }
    const successful = { tcp: 'TCP_CONNECTED', dicom: 'C_ECHO_SUCCESS', http: 'HTTP_RESPONSE', https: 'HTTP_RESPONSE', mllp: 'APPLICATION_ACCEPT' };
    if (lastDiagnostic.result.classification !== successful[lastDiagnostic.type]) { $('#diagnostic-baseline-status').textContent = 'Only a successful complete diagnostic can become the known-good baseline.'; return; }
    const baseline = makeBaseline(lastDiagnostic.result, lastDiagnostic.type, { profileId: profile.id, label: profile.label, host: profile.host, port: profile.port });
    loadedBaseline = await api.request('/api/diagnostics/baseline', { method: 'POST', body: { action: 'save', baseline } }); lastComparison = []; $('#diagnostic-baseline-status').textContent = 'Known-good baseline saved locally for ' + profile.label + '.'; $('#diagnostic-baseline-comparison').textContent = 'Current result matches the newly saved baseline.';
  });
  $('#diagnostic-baseline-load').addEventListener('click', async () => {
    const profileId = $('#diagnostic-profile-select').value; if (!profileId) { $('#diagnostic-baseline-status').textContent = 'Select a saved endpoint profile first.'; return; }
    const response = await api.request('/api/diagnostics/baseline', { method: 'POST', body: { action: 'get', profileId } }); loadedBaseline = response.baseline;
    $('#diagnostic-baseline-status').textContent = loadedBaseline ? 'Loaded baseline saved ' + loadedBaseline.savedAt + '.' : 'No baseline is saved for this profile.';
    lastComparison = loadedBaseline && lastDiagnostic && loadedBaseline.type === lastDiagnostic.type ? compareBaseline(loadedBaseline, lastDiagnostic.result) : [];
    $('#diagnostic-baseline-comparison').textContent = lastComparison.length ? lastComparison.join(' ') : 'Run the matching diagnostic to compare current evidence.';
  });
  $('#diagnostic-evidence-run').addEventListener('click', () => {
    if (!lastDiagnostic) { $('#diagnostic-evidence-observed').textContent = 'OBSERVED: No diagnostic result is available.'; return; }
    const validationSummary = $('#validation-summary').textContent || '', dicomFindings = $('#dicom-findings').textContent || '';
    const summary = correlateEvidence({ type: lastDiagnostic.type, result: lastDiagnostic.result, validationSummary, dicomEvidence: Boolean(dicomFindings && !/No baseline metadata concerns/i.test(dicomFindings)), baselineChanges: lastComparison });
    $('#diagnostic-evidence-observed').textContent = 'OBSERVED: ' + summary.observed.join(' '); $('#diagnostic-evidence-boundary').textContent = 'LIKELY BOUNDARY: ' + summary.likelyBoundary; $('#diagnostic-evidence-missing').textContent = 'MISSING EVIDENCE: ' + summary.missingEvidence; $('#diagnostic-evidence-next').textContent = 'NEXT CHECK: ' + summary.nextCheck;
  });
}
