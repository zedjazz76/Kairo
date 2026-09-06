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
}
