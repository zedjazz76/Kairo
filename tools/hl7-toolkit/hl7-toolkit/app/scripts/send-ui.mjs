import { createSingleSender } from './send-workflow.mjs';

export async function mountSend(controller, api) {
  const { state, $, all, node, bind, active, status, workerCall, saveEvent, historyReady, runValidation } = controller;
  let profiles = [];
  let profileId = crypto.randomUUID();
  let checking = false;
  const fieldIds = ['profile-label', 'profile-environment', 'profile-host', 'profile-port', 'connect-timeout', 'response-timeout', 'profile-encoding', 'frame-start', 'frame-end', 'profile-notes'];
  function readProfile() {
    const start = $('#frame-start').value.trim();
    const end = $('#frame-end').value.trim();
    if (!/^[0-9a-f]{2}$/i.test(start) || !/^[0-9a-f]{2}(?:\s+[0-9a-f]{2}){0,7}$/i.test(end)) throw new Error('PROFILE_FRAMING_REJECTED');
    return { schema: 'hl7-toolkit.endpoint-profile.v1', id: profileId, label: $('#profile-label').value.trim(), environment: $('#profile-environment').value,
      host: $('#profile-host').value.trim(), port: Number($('#profile-port').value), connectTimeoutMs: Number($('#connect-timeout').value), responseTimeoutMs: Number($('#response-timeout').value),
      encoding: $('#profile-encoding').value, startByte: parseInt(start, 16), endBytes: end.split(/\s+/).map((byte) => parseInt(byte, 16)), notes: $('#profile-notes').value.trim() };
  }
  function applyProfile(profile) {
    profileId = profile?.id || crypto.randomUUID();
    const values = [profile?.label || '', profile?.environment || 'Test', profile?.host || '', profile?.port || 2575, profile?.connectTimeoutMs || 5000, profile?.responseTimeoutMs || 10000,
      profile?.encoding || 'utf-8', (profile?.startByte ?? 11).toString(16).padStart(2, '0').toUpperCase(), (profile?.endBytes || [28, 13]).map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' '), profile?.notes || ''];
    fieldIds.forEach((id, index) => { $('#' + id).value = String(values[index]); });
    update();
  }
  async function refreshProfiles(selected = '') {
    const result = await api.request('/api/profiles/endpoint'); profiles = result.profiles;
    const select = $('#endpoint-profile'); select.replaceChildren();
    const placeholder = node('option', 'New profile'); placeholder.value = ''; select.append(placeholder);
    for (const profile of profiles) { const option = node('option', profile.label + ' · ' + profile.environment); option.value = profile.id; select.append(option); }
    select.value = selected;
    if (result.invalidCount) $('#endpoint-status').textContent = result.invalidCount + ' invalid profiles were not loaded. Check the local data folder.';
    update();
  }
  function update() {
    const busy = sender.busy || checking;
    state.sendBusy = sender.busy;
    $('#production-banner').hidden = $('#profile-environment').value !== 'Production';
    $('#send-one').disabled = busy || !active() || state.rawDraftDirty || !state.historyHealthy;
    $('#save-profile').disabled = busy;
    $('#check-endpoint').disabled = busy;
    $('#delete-profile').disabled = busy || !$('#endpoint-profile').value;
    $('#end-session').disabled = busy;
    if (state.rawDraftDirty) $('#send-result').textContent = 'Apply the pending raw edit in Inspect before sending.';
  }
  function confirmReview(review) {
    return new Promise((resolve) => {
      const dialog = $('#send-review-dialog');
      const production = review.kind === 'production';
      $('#send-review-title').textContent = production ? 'Confirm Production delivery' : 'Review this one message';
      $('#send-review-destination').textContent = review.profile.label + ' · ' + review.profile.environment + ' · ' + review.profile.host + ':' + review.profile.port + ' · ' + review.profile.encoding;
      $('#send-review-note').textContent = production ? 'The original edited message may contain patient PHI. Confirm that this is the intended, authorized Production destination.' : 'Only the message below will be sent. Line endings are normalized to HL7 carriage returns. MLLP is not encrypted; use an approved network.';
      $('#send-preview').textContent = review.message || ''; $('#send-preview').hidden = production;
      const warnings = $('#send-review-warnings'); warnings.replaceChildren();
      for (const warning of review.warnings || []) {
        const label = node('label', undefined, 'finding warning check-label');
        const checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.value = warning.id; checkbox.dataset.sendWarning = 'true';
        label.append(checkbox, node('span', (warning.path ? warning.path + ': ' : '') + warning.summary)); warnings.append(label);
      }
      $('#send-review-all').hidden = !review.requiredIds?.length;
      $('#send-review-confirm').textContent = production ? 'Confirm Production send' : 'Send this one message';
      let answer = { confirmed: false };
      const checks = () => all('[data-send-warning]:checked').map((checkbox) => checkbox.value);
      const ready = () => { $('#send-review-confirm').disabled = (review.requiredIds || []).some((id) => !checks().includes(id)); };
      warnings.onchange = ready;
      $('#send-review-all').onclick = () => { all('[data-send-warning]').forEach((checkbox) => { checkbox.checked = true; }); ready(); };
      $('#send-review-cancel').onclick = () => dialog.close();
      $('#send-review-confirm').onclick = () => { answer = { confirmed: true, acknowledgedIds: checks() }; dialog.close(); };
      dialog.onclose = () => { $('#send-preview').textContent = ''; warnings.replaceChildren(); resolve(answer); };
      ready(); dialog.showModal(); $('#send-review-cancel').focus();
    });
  }
  const sender = createSingleSender({
    getSnapshot: () => ({ text: active()?.text || '', messageId: state.activeId, profile: readProfile(), mode: $('#send-content-mode').value, dirty: Boolean(state.rawDraftDirty), findings: state.findings }),
    historyReady, sanitize: (text, mode) => workerCall('sanitize', text, mode), saveEvent, confirm: confirmReview,
    send: (payload) => api.request('/api/mllp/send-one', { method: 'POST', body: payload }),
  });
  state.onValidation = update;
  for (const id of [...fieldIds, 'send-content-mode']) bind('#' + id, 'input', update);
  bind('#endpoint-profile', 'change', () => applyProfile(profiles.find((profile) => profile.id === $('#endpoint-profile').value)));
  bind('#save-profile', 'click', async () => { const saved = await api.request('/api/profiles/endpoint', { method: 'POST', body: { profile: readProfile() } }); await refreshProfiles(saved.id); status('Destination profile saved locally.'); });
  bind('#delete-profile', 'click', async () => {
    const id = $('#endpoint-profile').value;
    if (!id || !confirm('Delete this saved endpoint profile? This cannot be undone.')) return;
    await api.request('/api/profiles/endpoint', { method: 'DELETE', body: { id } }); await refreshProfiles(); applyProfile(null); status('Saved endpoint profile deleted. This cannot be undone.');
  });
  bind('#check-endpoint', 'click', async () => {
    const profile = readProfile(); checking = true; update(); $('#endpoint-status').textContent = 'Checking connection only; no HL7 is sent…';
    try { const result = await api.request('/api/mllp/check', { method: 'POST', body: { profile } }); $('#endpoint-status').textContent = result.status === 'reachable' ? 'TCP connection reached in ' + result.latencyMs + ' ms. This does not verify an HL7 receiver.' : 'Connection failed or timed out. Check the destination and network access.'; }
    finally { checking = false; update(); }
  });
  bind('#send-one', 'click', async () => {
    await runValidation();
    $('#ack-raw').textContent = ''; $('#send-result').textContent = 'Preparing the selected message for review…';
    const operation = sender.run(); update();
    try {
      const result = await operation;
      if (result.status === 'canceled') { $('#send-result').textContent = 'Canceled. Nothing was sent.'; return; }
      const labels = { 'application-accept': 'Application accepted the message', 'application-error': 'Application reported an error', 'application-reject': 'Application rejected the message', 'commit-accept': 'Receiver committed the message; application processing is not confirmed', 'commit-error': 'Receiver reported a commit error', 'commit-reject': 'Receiver rejected the commit' };
      let summary = result.ack?.valid && result.ack.correlated ? labels[result.ack.category] + ' (' + result.ack.code + ').' : result.status === 'connect-failed' ? 'Connection failed before any write was attempted.' : 'Delivery is uncertain. Inspect the receiving system before deciding whether to send again.';
      if (result.status === 'send-failed') summary = 'Not sent. The helper rejected the input before transmission: ' + result.errorCode + '. Check the message, encoding, and destination settings.';
      summary += ' ' + result.bytesSent + ' bytes confirmed written · ' + result.latencyMs + ' ms. No automatic retry.';
      if (result.ack?.valid && !result.ack.correlated) summary += ' WARNING: the response control ID does not match this message.';
      if (!result.historySaved) summary += ' The result could not be saved to history. Keep this session open; do not resend merely to create a log.';
      const container = $('#send-result'); container.replaceChildren(node('p', summary));
      for (const error of result.ack?.errors || []) container.append(node('p', [error.location, error.code, error.description, error.severity, error.diagnostic, error.userMessage].filter(Boolean).join(' · ')));
      $('#ack-raw').textContent = result.response || '(No framed response received)';
      status(result.historySaved ? 'Send attempt finished; sanitized history saved.' : 'Send attempt finished; history needs attention.', !result.historySaved);
    } finally { update(); }
  });
  await refreshProfiles();
  $('#endpoint-status').textContent = 'Ready. Enter a destination or select a saved profile. Labels and notes must not contain PHI or secrets.';
}
