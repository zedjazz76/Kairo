import { getValue, parseHl7 } from './hl7-parser.mjs';
import { applyEdit } from './editor.mjs';
import { exactDiff, semanticDiff } from './diff.mjs';
import { copySanitized, countWarningTypes } from './clipboard.mjs';
import { historySafeText } from './sanitizer.mjs';
import { hashMessage, summarizeSendPreflight, validateBasic } from './validator.mjs';
import { createHistoryQueue } from './history-queue.mjs';
import { createWorkerRequests } from './worker-requests.mjs';
import { createFilterResultGate, filterMessages, isDeepFilter, validateFilter } from './search-filter.mjs';
import { evaluateCollection, evaluateProfile, validateProfilePack } from './profile-validator.mjs';
import { createSegmentHelpIndex, renderSegmentPurpose } from './segment-help.mjs';

export function createWorkbenchState() {
  return { messages: [], activeId: null, workspace: 'home', compareA: null, compareB: null, selectedPath: null, findings: [], acknowledgedFindingIds: [], intakeRunning: false, historyHealthy: true,
    sourceGeneration: 0, catalogFilter: { conditions: [], matchingIds: null, running: false, error: '' } };
}

export function fieldDefinitionText(basicFields, path) {
  const base = path.replace(/\[\d+\]/g, '').split('.')[0];
  const definition = basicFields.fields[base];
  return definition ? definition.label + ' · ' + definition.datatype : 'No Phase 1 label for this path — not evaluated.';
}

export function getSelectedMessageSnapshot(state) {
  const message = state.messages.find(({ id }) => id === state.activeId);
  return message ? structuredClone({ generation: state.sourceGeneration, id: message.id, index: message.index, type: message.type, text: message.text }) : null;
}

export function selectMessage(state, id) {
  if (!state.messages.some((message) => message.id === id)) throw new Error('MESSAGE_NOT_FOUND');
  state.activeId = id;
  state.selectedPath = null;
  state.acknowledgedFindingIds = [];
  state.sourceGeneration += 1;
}

export function editActiveMessage(state, operation) {
  const message = state.messages.find(({ id }) => id === state.activeId);
  if (!message) throw new Error('SELECT_ONE_MESSAGE');
  const receipt = applyEdit(parseHl7(message.text), operation);
  message.undo ??= [];
  message.redo ??= [];
  message.undo.push(receipt);
  message.redo.length = 0;
  message.text = receipt.after;
  message.sanitized = null;
  state.acknowledgedFindingIds = [];
  state.sourceGeneration += 1;
  return receipt;
}

export function undoActiveMessage(state) {
  const message = state.messages.find(({ id }) => id === state.activeId);
  const receipt = message?.undo?.pop();
  if (!receipt) return;
  message.redo.push(receipt);
  message.text = receipt.before;
  message.sanitized = null;
  state.acknowledgedFindingIds = [];
  state.sourceGeneration += 1;
}

export function redoActiveMessage(state) {
  const message = state.messages.find(({ id }) => id === state.activeId);
  const receipt = message?.redo?.pop();
  if (!receipt) return;
  message.undo.push(receipt);
  message.text = receipt.after;
  message.sanitized = null;
  state.acknowledgedFindingIds = [];
  state.sourceGeneration += 1;
}

export function mountWorkbench(root, state, { api, rules, token, basicFields = { fields: {} }, segmentDefinitions = { schema: 'kairo.hl7-segment-purposes.v1', segments: [] }, validationPack, navigation }) {
  const document = root.ownerDocument || root;
  const $ = (selector) => root.querySelector(selector);
  const all = (selector) => [...root.querySelectorAll(selector)];
  const worker = new Worker('/workers/intake-worker.mjs', { type: 'module' });
  const workerRequests = createWorkerRequests((message) => worker.postMessage(message));
  const selectedMessageListeners = new Set();
  const notifySelectedMessageChange = reason => {
    for (const listener of selectedMessageListeners) listener({ generation: state.sourceGeneration, reason });
  };
  const historyQueue = createHistoryQueue((event) => api.saveSanitizedEvent(event), ({ pending, failed, healthy }) => {
    state.historyHealthy = healthy && !workerRequests.failed;
    $('#history-status').textContent = failed ? failed + ' unsaved history events' : pending ? 'Saving history (' + pending + ')' : 'Sanitized history saved';
    $('#retry-history').hidden = !failed;
    if (failed) status('History could not be saved. Keep this session open and use Retry history after checking free disk space and the helper.', true);
    state.onValidation?.();
  });
  let visibleMessages = 200;
  let quickResult = null;
  let comparisonPair = null;
  let savedHistoryText = '';
  let renderScheduled = false;
  let loadedValidationPack = validateProfilePack(validationPack);
  const filterResultGate = createFilterResultGate();
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const active = () => state.messages.find((message) => message.id === state.activeId);
  const segmentHelp = createSegmentHelpIndex(segmentDefinitions);
  const fieldDescription = node('p', 'Choose a field to see its Phase 1 label.', 'small');
  $('#field-path').insertAdjacentElement('afterend', fieldDescription);
  function describeField(path) {
    fieldDescription.textContent = fieldDefinitionText(basicFields, path);
  }
  function showSegmentPurpose(segment, parsed) {
    renderSegmentPurpose(document, $('#segment-purpose'), segmentHelp.get(segment, getValue(parsed, 'MSH-12') || ''));
  }
  function status(text, error = false) {
    $('#service-status').textContent = text;
    $('#service-status').classList.toggle('error', error);
  }
  function handleError(error) {
    const messages = {
      SELECT_ONE_MESSAGE: 'Select one message in Inspect first.',
      STRUCTURAL_DELIMITER_REQUIRES_ESCAPE: 'Use an HL7 escape for a literal delimiter, or make the structural change in Raw view.',
      UNRESOLVED_SANITIZER_WARNINGS: 'Review and acknowledge every warning before copying.',
      HISTORY_WRITE_FAILED: 'History could not be saved. Copy and send remain blocked.',
    };
    status(messages[error.message] || ('Action did not complete: ' + (/^[A-Z_]+$/.test(error.message) ? error.message : 'check the input and local helper.')), true);
  }
  function bind(selector, event, action) {
    $(selector).addEventListener(event, async (eventObject) => {
      try { await action(eventObject); } catch (error) { handleError(error); }
    });
  }
  function workerCall(type, text, mode = 'chat-safe') {
    return workerRequests.call(type, text, mode);
  }
  function saveEvent(event) {
    return historyQueue.save(event);
  }
  function archiveResult(result, type = 'message-save') {
    return saveEvent({ schema: 'hl7-toolkit.sanitized-event.v1', type, sanitizedText: historySafeText(result),
      policyVersion: result.policyVersion, mode: 'chat-safe', warningCounts: countWarningTypes(result.warnings), overrideCount: 0, outcome: 'saved' });
  }
  async function snapshotActive() {
    const message = active();
    if (message) await archiveResult(await workerCall('sanitize', message.text, 'chat-safe'));
  }
  function showWorkspace(name) {
    state.workspace = name;
    if (navigation) navigation.showWorkspace(name);
    else all('[data-workspace]').forEach((section) => { section.hidden = section.dataset.workspace !== name; });
    all('[data-nav]').forEach((button) => {
      if (button.dataset.nav === name) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    if (name === 'compare') renderCompareSelectors();
    if (name === 'history') refreshHistory().catch(handleError);
  }
  function renderCatalog() {
    const query = $('#catalog-filter').value.toLowerCase();
    const allowed = state.catalogFilter.matchingIds && new Set(state.catalogFilter.matchingIds);
    const matching = state.messages.filter((message) => (!allowed || allowed.has(message.id)) && (!query || (message.type + ' ' + message.controlId + ' ' + (message.index + 1)).toLowerCase().includes(query)));
    $('#message-count').textContent = matching.length === state.messages.length ? state.messages.length.toLocaleString() : matching.length.toLocaleString() + ' of ' + state.messages.length.toLocaleString();
    const list = $('#message-list');
    list.replaceChildren();
    for (const message of matching.slice(0, visibleMessages)) {
      const button = node('button', undefined, 'message-item');
      button.setAttribute('aria-pressed', String(message.id === state.activeId));
      button.append(node('strong', (message.index + 1) + '. ' + (message.type || 'Unknown type')), node('small', message.controlId || 'No control ID'), node('small', (message.version || 'Unknown version') + ' · ' + message.length.toLocaleString() + ' characters'));
      button.addEventListener('click', () => { selectMessage(state, message.id); notifySelectedMessageChange('MESSAGE_SELECTED'); renderActive(); renderCatalog(); });
      list.append(button);
    }
    $('#more-messages').hidden = matching.length <= visibleMessages;
  }
  function addFilterCondition(condition = {}) {
    const id = condition.id || crypto.randomUUID();
    const row = node('div', undefined, 'filter-condition'); row.dataset.conditionId = id;
    const targetLabel = node('label', 'Target'); const target = node('select'); target.dataset.filterTarget = 'true';
    for (const [value, label] of [['metadata', 'Catalog metadata'], ['path', 'HL7 field path']]) { const option = node('option', label); option.value = value; target.append(option); }
    target.value = condition.target || 'metadata'; targetLabel.append(target);
    const fieldLabel = node('label', 'Field or path'); const field = node('input'); field.dataset.filterField = 'true'; field.autocomplete = 'off'; field.placeholder = 'type or PID-3.1'; field.value = condition.field || 'type'; fieldLabel.append(field);
    const operatorLabel = node('label', 'Operator'); const operator = node('select'); operator.dataset.filterOperator = 'true';
    for (const value of ['exists', 'missing', 'empty', 'equals', 'contains', 'regex', 'greater-than', 'less-than']) { const option = node('option', value.replace('-', ' ')); option.value = value; operator.append(option); }
    operator.value = condition.operator || 'contains'; operatorLabel.append(operator);
    const valueLabel = node('label', 'Value'); const value = node('input'); value.dataset.filterValue = 'true'; value.autocomplete = 'off'; value.maxLength = 256; value.value = condition.value || ''; valueLabel.append(value);
    const remove = node('button', 'Remove condition', 'remove-filter'); remove.type = 'button'; remove.addEventListener('click', () => row.remove());
    target.addEventListener('change', () => { if (target.value === 'path' && !field.value.includes('-')) field.value = 'PID-3.1'; });
    row.append(targetLabel, fieldLabel, operatorLabel, valueLabel, remove); $('#filter-conditions').append(row);
  }
  function readFilterControls() {
    return { conditions: [...$('#filter-conditions').children].map((row) => ({
      id: row.dataset.conditionId, target: row.querySelector('[data-filter-target]').value,
      field: row.querySelector('[data-filter-field]').value.trim(), operator: row.querySelector('[data-filter-operator]').value,
      value: row.querySelector('[data-filter-value]').value,
    })) };
  }
  function setFilterResult(result) {
    state.catalogFilter.matchingIds = result.ids; state.catalogFilter.running = false; state.catalogFilter.error = '';
    $('#filter-status').textContent = result.matched.toLocaleString() + ' of ' + result.total.toLocaleString() + ' messages match.';
    $('#filter-error').textContent = ''; $('#apply-filters').disabled = false; visibleMessages = 200; renderCatalog();
  }
  async function applyAdvancedFilter() {
    const revision = filterResultGate.begin();
    const normalized = validateFilter(readFilterControls());
    state.catalogFilter.conditions = normalized.conditions;
    if (!normalized.conditions.length) { clearAdvancedFilters(); return; }
    state.catalogFilter.running = true; $('#apply-filters').disabled = true; $('#filter-error').textContent = '';
    try {
      if (isDeepFilter(normalized)) {
        const result = await workerRequests.filter(state.messages, normalized, ({ processed, total, matched }) => {
          $('#filter-status').textContent = 'Filtering ' + processed.toLocaleString() + ' of ' + total.toLocaleString() + ' · ' + matched.toLocaleString() + ' matches';
        });
        if (filterResultGate.accept(revision)) setFilterResult(result);
      } else {
        const result = await filterMessages(state.messages, normalized, { chunkSize: state.messages.length || 1 });
        if (filterResultGate.accept(revision)) setFilterResult(result);
      }
    } catch (error) {
      if (!filterResultGate.accept(revision)) return;
      state.catalogFilter.running = false; $('#apply-filters').disabled = false;
      if (error.name !== 'AbortError') { state.catalogFilter.error = error.code || 'FILTER_INVALID'; $('#filter-error').textContent = 'Check the field, operator, and value in each condition.'; }
    }
  }
  function clearAdvancedFilters() {
    filterResultGate.invalidate(); state.catalogFilter = { conditions: [], matchingIds: null, running: false, error: '' };
    $('#filter-conditions').replaceChildren(); addFilterCondition(); $('#filter-status').textContent = 'No advanced filters applied.';
    $('#filter-error').textContent = ''; $('#apply-filters').disabled = false; visibleMessages = 200; renderCatalog();
  }
  function scheduleCatalogRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => { renderScheduled = false; renderCatalog(); });
  }
  function renderTree(parsed) {
    const tree = $('#tree-view');
    tree.replaceChildren();
    for (const segment of parsed.segments) {
      const segmentDetails = node('details');
      const segmentSummary = node('summary', (segment.index + 1) + '. ' + segment.name + ' · ' + (segment.fields.length - 1) + ' fields');
      segmentSummary.addEventListener('click', () => showSegmentPurpose(segment.name, parsed));
      segmentDetails.addEventListener('toggle', () => { if (segmentDetails.open) showSegmentPurpose(segment.name, parsed); });
      segmentDetails.append(segmentSummary);
      const segmentPath = segment.name + (segment.occurrence > 1 ? '[' + segment.occurrence + ']' : '');
      segment.fields.forEach((field, fieldIndex) => {
        if (!field) return;
        const fieldDetails = node('details');
        fieldDetails.append(node('summary', segmentPath + '-' + fieldIndex + (field.raw ? '' : ' (empty)')));
        field.repetitions.forEach((repetition, repetitionIndex) => {
          const repeatDetails = node('details');
          repeatDetails.open = field.repetitions.length === 1;
          repeatDetails.append(node('summary', 'Repetition ' + (repetitionIndex + 1)));
          repetition.forEach((component, componentIndex) => component.forEach((value, subcomponentIndex) => {
            const path = segmentPath + '-' + fieldIndex + (field.repetitions.length > 1 ? '[' + (repetitionIndex + 1) + ']' : '') +
              (field.literal ? '' : '.' + (componentIndex + 1) + (component.length > 1 ? '.' + (subcomponentIndex + 1) : ''));
            const button = node('button', path + ' = ' + (value || '(empty)'), 'tree-value');
            button.addEventListener('click', () => {
              state.selectedPath = path; $('#field-path').value = path; $('#field-value').value = value;
              $('#segment-index').value = String(segment.index); showSegmentPurpose(segment.name, parsed); describeField(path); $('#field-value').focus();
            });
            repeatDetails.append(button);
          }));
          fieldDetails.append(repeatDetails);
        });
        segmentDetails.append(fieldDetails);
      });
      tree.append(segmentDetails);
    }
  }
  function renderActive() {
    const message = active();
    state.rawDraftDirty = false;
    for (const id of ['raw-editor', 'apply-raw', 'apply-field', 'sanitize-active', 'use-compare-a', 'use-compare-b', 'clone-segment', 'move-segment-up', 'move-segment-down', 'remove-segment', 'add-segment']) $('#' + id).disabled = !message;
    $('#undo-edit').disabled = !message?.undo?.length;
    $('#redo-edit').disabled = !message?.redo?.length;
    $('#raw-editor').value = message?.text || '';
    $('#active-title').textContent = message ? 'Message ' + (message.index + 1) + ' · ' + (message.type || 'Unknown type') : 'Select a message';
    $('#send-message-label').textContent = message ? 'Selected: message ' + (message.index + 1) + ' · ' + message.type + ' · ' + message.controlId : 'Select one message in Inspect.';
    const segmentSelect = $('#segment-index');
    segmentSelect.replaceChildren();
    if (!message) return;
    const parsed = parseHl7(message.text);
    message.controlId = getValue(parsed, 'MSH-10') || ''; message.type = getValue(parsed, 'MSH-9') || ''; message.length = message.text.length;
    const d = parsed.delimiters;
    $('#delimiter-info').textContent = 'Delimiters: field ' + d.field + ' · component ' + d.component + ' · repeat ' + d.repetition + ' · escape ' + d.escape + ' · subcomponent ' + d.subcomponent;
    parsed.segments.forEach((segment) => { const option = node('option', (segment.index + 1) + '. ' + segment.name); option.value = String(segment.index); segmentSelect.append(option); });
    renderTree(parsed);
    runValidation().catch(handleError);
  }
  function renderFindings(target, findings, allowAcknowledgement) {
    target.replaceChildren();
    for (const finding of findings) {
      const item = node('div', undefined, 'finding ' + finding.severity);
      item.append(node('strong', finding.severity.toUpperCase() + ' · ' + finding.path), node('p', finding.summary), node('small', finding.source + ' · ' + finding.code));
      if (allowAcknowledgement && ['error', 'warning'].includes(finding.severity)) {
        if (finding.overridable) {
          const label = node('label', undefined, 'check-label');
          const checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.value = finding.id; checkbox.dataset.finding = 'true';
          checkbox.checked = state.acknowledgedFindingIds.includes(finding.id);
          checkbox.addEventListener('change', () => {
            const acknowledged = new Set(state.acknowledgedFindingIds);
            if (checkbox.checked) acknowledged.add(finding.id); else acknowledged.delete(finding.id);
            state.acknowledgedFindingIds = [...acknowledged];
            all('[data-finding]').filter((input) => input.value === finding.id).forEach((input) => { input.checked = checkbox.checked; });
            state.onValidation?.();
          });
          label.append(checkbox, node('span', 'I reviewed this finding and accept it for this exact message.'));
          item.append(label);
        } else item.append(node('strong', 'This one-message safety restriction cannot be overridden.'));
      }
      target.append(item);
    }
  }
  async function runValidation() {
    const message = active();
    if (!message) throw new Error('SELECT_ONE_MESSAGE');
    const source = message.text;
    const fingerprint = await hashMessage(source);
    if (active()?.id !== message.id || active()?.text !== source) return;
    if (state.validationHash !== fingerprint) state.acknowledgedFindingIds = [];
    state.validationHash = fingerprint;
    const controlIds = new Map();
    for (const item of state.messages) if (item.controlId) controlIds.set(item.controlId, (controlIds.get(item.controlId) || 0) + 1);
    state.findings = [...validateBasic(parseHl7(source), { controlIds }), ...evaluateProfile(parseHl7(source), loadedValidationPack), ...evaluateCollection(state.messages, loadedValidationPack)];
    const summary = summarizeSendPreflight(state.findings, state.acknowledgedFindingIds);
    $('#validation-summary').textContent = summary.counts.error + ' errors · ' + summary.counts.warning + ' warnings · ' + summary.counts['not-evaluated'] + ' not evaluated. Acknowledgements apply only to this exact message.';
    $('#inspect-findings-count').textContent = String(state.findings.length);
    renderFindings($('#inspect-findings'), state.findings, false);
    renderFindings($('#validation-results'), state.findings, true);
    renderFindings($('#send-preflight'), state.findings, true);
    state.onValidation?.();
    return { ...summary, hash: fingerprint, findings: state.findings };
  }
  function renderCompareSelectors() {
    for (const [selector, selected, label] of [['#compare-a', state.compareA, 'A'], ['#compare-b', state.compareB, 'B']]) {
      const select = $(selector); select.replaceChildren();
      const placeholder = node('option', 'Choose message ' + label); placeholder.value = ''; select.append(placeholder);
      const options = state.messages.slice(0, 1000);
      const extra = state.messages.find((message) => message.id === selected);
      if (extra && !options.includes(extra)) options.push(extra);
      for (const message of options) { const option = node('option', (message.index + 1) + '. ' + message.type + ' · ' + message.controlId); option.value = message.id; select.append(option); }
      select.value = selected || '';
    }
  }
  function renderComparison() {
    state.compareA = $('#compare-a').value; state.compareB = $('#compare-b').value;
    const left = state.messages.find((message) => message.id === state.compareA);
    const right = state.messages.find((message) => message.id === state.compareB);
    if (!left || !right || left === right) throw new Error('SELECT_TWO_DIFFERENT_MESSAGES');
    const ignoredPaths = $('#ignore-paths').value.split(',').map((path) => path.trim()).filter(Boolean);
    if ($('#ignore-timestamps').checked) ignoredPaths.push('MSH-7');
    if ($('#ignore-control').checked) ignoredPaths.push('MSH-10');
    const exact = $('#compare-mode').value === 'exact';
    const changes = exact ? exactDiff(left.text, right.text) : semanticDiff(parseHl7(left.text), parseHl7(right.text), { ignoredPaths });
    const table = node('table'); const header = node('tr');
    ['Path / range', 'Change', 'Message A', 'Message B'].forEach((label) => header.append(node('th', label))); table.append(header);
    for (const change of changes.slice(0, 2000)) {
      const row = node('tr');
      const values = [change.path || change.leftStart + '–' + change.leftEnd + ' → ' + change.rightStart + '–' + change.rightEnd, change.kind, change.before === undefined ? '(missing)' : JSON.stringify(change.before), change.after === undefined ? '(missing)' : JSON.stringify(change.after)];
      values.forEach((value, index) => row.append(node('td', value, index > 1 ? 'code' : ''))); table.append(row);
    }
    $('#compare-results').replaceChildren(table);
    $('#compare-summary').textContent = changes.length.toLocaleString() + (exact ? ' exact changed window' : ' changed paths') + (changes.length > 2000 ? ' (first 2,000 shown)' : '') + '. Escapes and line endings are shown explicitly.';
    comparisonPair = [left.text, right.text]; $('#save-comparison').disabled = false;
  }
  function renderQuick(result) {
    quickResult = result; $('#quick-output').value = result.text;
    $('#sanitize-summary').textContent = result.replacements.length + ' replacements · ' + result.warnings.length + ' review warnings · policy ' + result.policyVersion;
    const container = $('#sanitize-warnings'); container.replaceChildren();
    for (const warning of result.warnings) {
      const label = node('label', undefined, 'finding warning check-label'); const checkbox = node('input');
      checkbox.type = 'checkbox'; checkbox.value = warning.id; checkbox.dataset.warning = 'true';
      label.append(checkbox, node('span', 'I reviewed ' + (warning.path || 'this content') + ': ' + warning.summary)); container.append(label);
    }
    $('#acknowledge-warnings').hidden = result.warnings.length === 0; $('#copy-sanitized').disabled = false;
  }
  function openQuick(text = '', textOnly = Boolean(text)) {
    $('#quick-input').value = text; $('#quick-output').value = ''; $('#sanitize-warnings').replaceChildren(); $('#sanitize-summary').textContent = '';
    $('#copy-sanitized').disabled = true; $('#acknowledge-warnings').hidden = true; quickResult = null;
    $('#quick-selector').hidden = textOnly; $('#quick-text-view').hidden = !textOnly; $('#quick-image-view').hidden = true; $('#quick-inline-guide').hidden = true;
    $('#quick-title').textContent = textOnly ? 'Prepare text for review.' : 'Choose what to sanitize.';
    $('#quick-dialog').showModal(); (textOnly ? $('#quick-input') : $('#quick-text-open')).focus();
  }
  async function refreshHistory() {
    const result = await api.getHistory();
    $('#history-size').textContent = result.sessions.length + ' sessions · ' + (result.totalBytes / 1048576).toFixed(2) + ' MB';
    const list = $('#history-list'); list.replaceChildren(); const query = $('#history-search').value.trim().toLowerCase();
    for (const session of result.sessions) {
      let detail;
      if (query) { detail = await api.getHistory(session.sessionId); if (!detail.sanitizedText.toLowerCase().includes(query)) continue; }
      const row = node('div', undefined, 'history-row'); const checkbox = node('input');
      checkbox.type = 'checkbox'; checkbox.value = session.sessionId; checkbox.dataset.session = 'true';
      checkbox.setAttribute('aria-label', 'Select session from ' + new Date(session.createdUtc).toLocaleString());
      checkbox.addEventListener('change', () => { $('#delete-history').disabled = !all('[data-session]:checked').length; });
      const label = node('span', new Date(session.createdUtc).toLocaleString() + ' · ' + session.eventCount + ' events · ' + (session.bytes / 1024).toFixed(1) + ' KB');
      const open = node('button', 'Open');
      open.addEventListener('click', async () => { try { const selected = detail || await api.getHistory(session.sessionId); savedHistoryText = selected.sanitizedText; $('#history-content').textContent = savedHistoryText; $('#history-detail').hidden = false; } catch (error) { handleError(error); } });
      row.append(checkbox, label, open); list.append(row);
    }
    $('#delete-history').disabled = true;
  }
  function load(request) {
    if (state.intakeRunning) throw new Error('INTAKE_ALREADY_RUNNING');
    if (request.file?.size > 104857600) throw new Error('FILE_TOO_LARGE');
    if (!request.file && !request.text?.trim()) throw new Error('PASTE_A_MESSAGE_FIRST');
    state.intakeRunning = true; $('#intake-progress').hidden = false; $('#progress-meter').value = 0;
    worker.postMessage({ type: 'catalog', id: crypto.randomUUID(), ...request }); showWorkspace('inspect');
    status('Reading locally. Early messages are available as the catalog grows.');
  }
  worker.onmessage = ({ data }) => {
    if (workerRequests.handle(data)) return;
    if (data.type === 'ready') { status('Protected local workspace ready. Load a file, paste messages, or use Quick Sanitize.'); return; }
    if (data.type === 'messages') {
      const count = state.messages.length;
      data.messages.forEach((message, index) => state.messages.push({ ...message, id: data.id + '-' + message.id, index: count + index, undo: [], redo: [] }));
      if (!state.activeId && state.messages.length) { selectMessage(state, state.messages[0].id); notifySelectedMessageChange('MESSAGE_SELECTED'); renderActive(); }
      scheduleCatalogRender();
    } else if (data.type === 'archive') {
      const warnings = data.results.flatMap((item) => item.result.warnings);
      saveEvent({ schema: 'hl7-toolkit.sanitized-event.v1', type: 'message-save', sanitizedText: data.results.map((item) => item.historyText).join('\r'), policyVersion: rules.version, mode: 'chat-safe', warningCounts: countWarningTypes(warnings), overrideCount: 0, outcome: 'saved' }).catch(() => {});
    } else if (data.type === 'progress') {
      $('#progress-meter').value = data.total ? data.processed / data.total * 100 : 100;
      $('#progress-label').textContent = Math.round(data.processed / 1048576) + ' MB · ' + data.messages.toLocaleString() + ' messages';
    } else if (['complete', 'canceled', 'error'].includes(data.type)) {
      state.intakeRunning = false; $('#intake-progress').hidden = true;
      if (data.type === 'complete') status('Loaded ' + data.count.toLocaleString() + ' messages. ' + data.warnings.map((item) => item.summary).join(' '));
      else status(data.type === 'canceled' ? 'Intake canceled. Already loaded messages remain available.' : data.summary, data.type === 'error');
      renderCatalog(); renderCompareSelectors();
    }
  };
  worker.onerror = () => {
    state.intakeRunning = false;
    workerRequests.fail(); state.historyHealthy = false; state.onValidation?.();
    status('The background worker stopped. Raw messages remain only in this tab; sanitizing and sending are unavailable. Reopen the toolkit.', true);
  };
  worker.postMessage({ type: 'initialize', id: crypto.randomUUID(), rules });
  addFilterCondition();
  all('[data-nav]').forEach((button) => button.addEventListener('click', () => showWorkspace(button.dataset.nav)));
  bind('#load-paste', 'click', () => load({ text: $('#paste-input').value }));
  bind('#file-input', 'change', (event) => { if (event.target.files[0]) load({ file: event.target.files[0] }); });
  bind('#load-demo', 'click', () => {
    const first = 'MSH|^~\\&|REG|SYNTHETIC|TOOL|TEST|202609031200||ADT^A01|DEMO-001|P|2.5.1\rPID|1||DEMO-MRN-001||EXAMPLE^ALPHA||19800506|U\rPV1|1|O\r';
    load({ text: first + first.replace('DEMO-001', 'DEMO-002').replace('ADT^A01', 'ADT^A08').replace('EXAMPLE^ALPHA', 'EXAMPLE^BRAVO') });
  });
  bind('#cancel-intake', 'click', () => worker.postMessage({ type: 'cancel' }));
  bind('#catalog-filter', 'input', () => { visibleMessages = 200; renderCatalog(); });
  bind('#add-filter-condition', 'click', () => addFilterCondition());
  bind('#apply-filters', 'click', applyAdvancedFilter);
  bind('#clear-filters', 'click', clearAdvancedFilters);
  bind('#more-messages', 'click', () => { visibleMessages += 200; renderCatalog(); });
  for (const event of ['dragenter', 'dragover']) $('#drop-zone').addEventListener(event, (item) => { item.preventDefault(); $('#drop-zone').classList.add('dragging'); });
  $('#drop-zone').addEventListener('dragleave', () => $('#drop-zone').classList.remove('dragging'));
  bind('#drop-zone', 'drop', (event) => { event.preventDefault(); $('#drop-zone').classList.remove('dragging'); if (event.dataTransfer.files.length !== 1) throw new Error('CHOOSE_ONE_FILE'); load({ file: event.dataTransfer.files[0] }); });
  bind('#raw-tab', 'click', () => { $('#raw-view').hidden = false; $('#tree-view').hidden = true; $('#raw-tab').setAttribute('aria-pressed', 'true'); $('#tree-tab').setAttribute('aria-pressed', 'false'); });
  bind('#tree-tab', 'click', () => { $('#raw-view').hidden = true; $('#tree-view').hidden = false; $('#raw-tab').setAttribute('aria-pressed', 'false'); $('#tree-tab').setAttribute('aria-pressed', 'true'); });
  async function afterEdit() { notifySelectedMessageChange('MESSAGE_CHANGED'); renderActive(); renderCatalog(); await snapshotActive(); status('Selected message updated. A sanitized snapshot was saved.'); }
  bind('#raw-editor', 'input', () => { state.rawDraftDirty = true; state.onValidation?.(); });
  bind('#apply-raw', 'click', async () => { editActiveMessage(state, { type: 'replace-raw', value: $('#raw-editor').value.replace(/\r?\n/g, '\r') }); await afterEdit(); });
  bind('#apply-field', 'click', async () => { editActiveMessage(state, { type: 'set-value', path: $('#field-path').value.trim(), value: $('#field-value').value }); await afterEdit(); });
  bind('#field-path', 'change', () => { if (active()) { $('#field-value').value = getValue(parseHl7(active().text), $('#field-path').value.trim()) || ''; describeField($('#field-path').value.trim()); } });
  bind('#undo-edit', 'click', async () => { undoActiveMessage(state); await afterEdit(); });
  bind('#redo-edit', 'click', async () => { redoActiveMessage(state); await afterEdit(); });
  for (const [selector, type, offset] of [['#clone-segment', 'clone-segment', 0], ['#remove-segment', 'remove-segment', 0], ['#move-segment-up', 'move-segment', -1], ['#move-segment-down', 'move-segment', 1]]) {
    bind(selector, 'click', async () => { const index = Number($('#segment-index').value); editActiveMessage(state, { type, index, toIndex: index + offset }); await afterEdit(); });
  }
  bind('#add-segment', 'click', async () => { editActiveMessage(state, { type: 'add-segment', index: Number($('#segment-index').value) + 1, value: $('#new-segment').value }); await afterEdit(); });
  bind('#use-compare-a', 'click', () => { state.compareA = state.activeId; status('Selected message assigned to comparison A.'); });
  bind('#use-compare-b', 'click', () => { state.compareB = state.activeId; showWorkspace('compare'); });
  bind('#run-compare', 'click', renderComparison);
  bind('#save-comparison', 'click', async () => { if (!comparisonPair) return; const results = await Promise.all(comparisonPair.map((text) => workerCall('sanitize', text))); await saveEvent({ schema: 'hl7-toolkit.sanitized-event.v1', type: 'comparison-save', sanitizedText: results.map(historySafeText).join('\r\r'), policyVersion: rules.version, mode: 'chat-safe', warningCounts: countWarningTypes(results.flatMap((item) => item.warnings)), overrideCount: 0 }); status('Sanitized comparison messages saved.'); });
  bind('#quick-open', 'click', () => openQuick());
  bind('#sanitize-active', 'click', () => openQuick(active()?.text || ''));
  bind('#quick-text-open', 'click', () => { $('#quick-selector').hidden = true; $('#quick-text-view').hidden = false; $('#quick-title').textContent = 'Prepare text for review.'; $('#quick-input').focus(); });
  bind('#quick-text-back', 'click', () => { $('#quick-text-view').hidden = true; $('#quick-selector').hidden = false; $('#quick-title').textContent = 'Choose what to sanitize.'; $('#quick-text-open').focus(); });
  bind('#quick-close', 'click', () => $('#quick-dialog').close());
  bind('#quick-input', 'input', () => { quickResult = null; $('#copy-sanitized').disabled = true; });
  bind('#sanitize-mode', 'change', () => { quickResult = null; $('#copy-sanitized').disabled = true; });
  bind('#quick-run', 'click', async () => {
    const text = $('#quick-input').value; if (!text.trim()) throw new Error('PASTE_TEXT_FIRST');
    $('#quick-run').disabled = true;
    try { const mode = $('#sanitize-mode').value; const result = await workerCall('sanitize', text, mode); renderQuick(result); await archiveResult(mode === 'chat-safe' ? result : await workerCall('sanitize', text, 'chat-safe')); }
    finally { $('#quick-run').disabled = false; }
  });
  bind('#acknowledge-warnings', 'click', () => all('[data-warning]').forEach((checkbox) => { checkbox.checked = true; }));
  bind('#copy-sanitized', 'click', async () => {
    if (!quickResult) throw new Error('SANITIZE_FIRST'); await historyQueue.ready(); if (!state.historyHealthy) throw new Error('HISTORY_WRITE_FAILED');
    const residual = await workerCall('scan', quickResult.text, quickResult.mode);
    const receipt = await copySanitized(quickResult, { acknowledgedWarningIds: all('[data-warning]:checked').map((item) => item.value), saveEvent, rescan: () => residual });
    $('#sanitize-summary').textContent = 'Copied ' + receipt.copiedCharacters.toLocaleString() + ' sanitized characters. ' + receipt.overrideCount + ' warning overrides recorded.';
  });
  bind('#refresh-history', 'click', refreshHistory);
  bind('#retry-history', 'click', async () => { await historyQueue.retry(); status('Pending sanitized history saved.'); });
  let searchTimer;
  bind('#history-search', 'input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => refreshHistory().catch(handleError), 300); });
  bind('#delete-history', 'click', async () => {
    const ids = all('[data-session]:checked').map((item) => item.value);
    if (!ids.length || !confirm('Permanently delete ' + ids.length + ' selected sanitized history session(s)? This cannot be undone.')) return;
    const result = await api.deleteHistory(ids); $('#history-detail').hidden = true; savedHistoryText = ''; await refreshHistory(); status('Deleted ' + result.deletedCount + ' sanitized history sessions. This cannot be undone.');
  });
  bind('#export-history', 'click', () => { const url = URL.createObjectURL(new Blob([savedHistoryText], { type: 'text/plain;charset=utf-8' })); const link = node('a'); link.href = url; link.download = 'hl7-sanitized-history.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); });
  bind('#run-validation', 'click', runValidation);
  bind('#validation-profile-file', 'change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      loadedValidationPack = validateProfilePack(JSON.parse(await file.text()));
      $('#validation-profile-status').textContent = 'Loaded local profile for this browser session only.';
      if (active()) await runValidation();
    } catch (error) {
      $('#validation-profile-status').textContent = 'The local profile was not loaded. Check its format.';
    } finally { event.target.value = ''; }
  });
  bind('#end-session', 'click', async () => {
    if (!confirm('End this session and erase the in-memory original messages? Saved sanitized history will remain.')) return;
    if (state.intakeRunning) throw new Error('CANCEL_OR_FINISH_INTAKE_FIRST');
    await historyQueue.ready();
    worker.terminate(); state.messages.length = 0; all('textarea').forEach((element) => { element.value = ''; });
    quickResult = null; comparisonPair = null; savedHistoryText = ''; location.replace('/#session=' + encodeURIComponent(token)); location.reload();
  });
  return { state, workerCall, saveEvent, snapshotActive, active, renderActive, runValidation, status, showWorkspace, handleError, bind, $, all, node,
    getSelectedMessageSnapshot: () => getSelectedMessageSnapshot(state),
    onSelectedMessageChange(listener) { selectedMessageListeners.add(listener); return () => selectedMessageListeners.delete(listener); },
    historyReady: async () => { await historyQueue.ready(); if (!state.historyHealthy) throw new Error('HISTORY_WRITE_FAILED'); } };
}
