export function mountDiagnostics(root, api) {
  const $ = selector => root.querySelector(selector);
  const layers = [['dns', 'DNS'], ['tcp', 'TCP'], ['association', 'DICOM association'], ['echo', 'C-ECHO']];
  let busy = false;
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
}
