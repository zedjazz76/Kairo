import { buildMwlRequest, emptyMwlState, mwlInspectorRows, normalizeMwlResult, todayLocal } from './mwl-model.mjs';

const value = (root, id) => root.querySelector('#mwl-' + id).value;

function visibleValues(root) {
  return {
    host: value(root, 'host'),
    port: value(root, 'port'),
    callingAe: value(root, 'calling'),
    calledAe: value(root, 'called'),
    timeoutMs: value(root, 'timeout'),
    criteria: {
      scheduledDate: value(root, 'scheduled-date'),
      modality: value(root, 'modality'),
      scheduledStationAe: value(root, 'station-ae'),
      patientId: value(root, 'patient-id'),
      accessionNumber: value(root, 'accession'),
      requestedProcedureId: value(root, 'requested-procedure-id'),
      requestedProcedureDescription: value(root, 'requested-procedure-description'),
      procedureCode: { value: value(root, 'procedure-code'), scheme: value(root, 'procedure-scheme') },
      scheduledLocation: value(root, 'location')
    }
  };
}

export function mountMwl(root, api, { now = () => new Date() } = {}) {
  const run = root.querySelector('#mwl-run');
  const status = root.querySelector('#mwl-status');
  root.querySelector('#mwl-scheduled-date').value = todayLocal(now());
  let active = false;
  let profiles = [];
  let state = emptyMwlState();
  let generation = 0;
  const comparisonListeners = new Set();
  const invalidateComparison = reason => {
    generation += 1;
    for (const listener of comparisonListeners) listener({ generation, reason });
  };

  const layerText = (label, layer) => `${label}: ${layer?.state ?? 'NOT_RUN'} · ${layer?.dicomStatus ? layer.dicomStatus + ' · ' : ''}${layer?.code ?? 'NOT_RUN'} · ${layer?.detail ?? 'Not attempted.'}`;
  const clearRendered = () => {
    root.querySelector('#mwl-summary').textContent = 'No MWL result is retained.';
    root.querySelector('#mwl-layer-dns').textContent = 'DNS: NOT_RUN';
    root.querySelector('#mwl-layer-tcp').textContent = 'TCP: NOT_RUN';
    root.querySelector('#mwl-layer-association').textContent = 'DICOM association: NOT_RUN';
    root.querySelector('#mwl-layer-cfind').textContent = 'C-FIND: NOT_RUN';
    root.querySelector('#mwl-match-summary').textContent = 'Matches retained: 0 · Query truncated: NO · Cancellation: NOT_RUN';
    root.querySelector('#mwl-results').replaceChildren();
    root.querySelector('#mwl-inspector').replaceChildren();
    root.querySelector('#mwl-warnings').textContent = '';
  };

  const renderInspector = item => {
    const inspector = root.querySelector('#mwl-inspector');
    const cell = text => { const td = root.createElement('td'); td.textContent = text ?? ''; return td; };
    const rows = mwlInspectorRows(item).map(entry => {
      const row = root.createElement('tr');
      const keyword = entry.path.includes(' → ') ? entry.path : entry.keyword;
      row.append(cell(entry.tag), cell(keyword), cell(entry.value), cell(entry.definition));
      return row;
    });
    inspector.replaceChildren(...rows);
  };

  const renderResult = (result, request) => {
    state = { result, request: structuredClone(request), items: result.items, selectedIndex: -1 };
    invalidateComparison('RESULT_REPLACED');
    root.querySelector('#mwl-summary').textContent = `${result.classification} · ${result.items.length} retained match${result.items.length === 1 ? '' : 'es'}`;
    root.querySelector('#mwl-layer-dns').textContent = layerText('DNS', result.dns);
    root.querySelector('#mwl-layer-tcp').textContent = layerText('TCP', result.tcp);
    root.querySelector('#mwl-layer-association').textContent = layerText('DICOM association', result.association);
    root.querySelector('#mwl-layer-cfind').textContent = layerText('C-FIND', result.cfind);
    const zero = result.classification === 'SUCCESS_ZERO_MATCHES' ? ' · Successful zero matches is not a network failure.' : '';
    root.querySelector('#mwl-match-summary').textContent = `Matches retained: ${result.matches?.retained ?? result.items.length} · Query truncated: ${result.matches?.truncated ? 'YES' : 'NO'} · Cancellation: ${result.cancellation?.code ?? 'NOT_RUN'}${zero}`;
    const rows = result.items.map((item, index) => {
      const row = root.createElement('tr');
      const step = item.scheduledProcedureStep ?? {};
      const dateTime = [step.scheduledDate, step.scheduledTime].filter(Boolean).join(' ');
      for (const field of [item.patientName, item.patientId, item.accessionNumber, item.requestedProcedureDescription, step.modality, step.scheduledStationAe, dateTime]) {
        const cell = root.createElement('td');
        cell.textContent = field ?? '';
        row.append(cell);
      }
      row.addEventListener('click', () => { state.selectedIndex = index; invalidateComparison('ITEM_SELECTED'); renderInspector(state.items[index]); });
      return row;
    });
    root.querySelector('#mwl-results').replaceChildren(...rows);
    root.querySelector('#mwl-inspector').replaceChildren();
    root.querySelector('#mwl-warnings').textContent = (result.warnings ?? []).map(warning => `${warning.code} · ${warning.tag} · ${warning.keyword} · ${warning.characterSet}`).join(' ');
  };

  root.querySelector('#mwl-profile-load').addEventListener('click', async () => {
    const response = await api.request('/api/profiles/endpoint');
    profiles = (response.profiles ?? []).filter(profile => profile.type === 'dicom');
    const blank = root.createElement('option'); blank.value = ''; blank.textContent = 'Select a DICOM profile';
    const options = [blank, ...profiles.map(profile => {
      const option = root.createElement('option'); option.value = profile.id; option.textContent = profile.label; return option;
    })];
    root.querySelector('#mwl-profile-select').replaceChildren(...options);
    status.textContent = `Loaded ${profiles.length} DICOM endpoint profile${profiles.length === 1 ? '' : 's'}. Select one and choose Fill endpoint.`;
  });

  root.querySelector('#mwl-profile-fill').addEventListener('click', () => {
    const selected = profiles.find(profile => profile.id === root.querySelector('#mwl-profile-select').value);
    if (!selected) return;
    root.querySelector('#mwl-host').value = selected.host ?? '';
    root.querySelector('#mwl-port').value = selected.port ?? '';
    root.querySelector('#mwl-calling').value = selected.callingAe ?? '';
    root.querySelector('#mwl-called').value = selected.calledAe ?? '';
    root.querySelector('#mwl-timeout').value = selected.responseTimeoutMs ?? 3000;
    status.textContent = 'Selected DICOM profile filled the endpoint. Review criteria and choose Run MWL C-FIND explicitly.';
  });

  root.querySelector('#mwl-clear').addEventListener('click', () => {
    state = emptyMwlState();
    invalidateComparison('RESULTS_CLEARED');
    clearRendered();
    status.textContent = 'MWL results cleared from this session. Query criteria were not sent.';
  });

  run.addEventListener('click', async () => {
    if (active) return;
    let request;
    try {
      request = buildMwlRequest(visibleValues(root));
    } catch (error) {
      status.textContent = error?.message === 'MWL_CRITERION_REQUIRED'
        ? 'MWL_QUERY_NOT_SENT: Enter at least one query criterion.'
        : 'MWL_QUERY_NOT_SENT: Check the visible endpoint and query values.';
      return;
    }
    active = true;
    run.disabled = true;
    status.textContent = 'MWL query in progress.';
    try {
      const response = await api.request('/api/dicom/mwl/find', { method: 'POST', body: request });
      const result = normalizeMwlResult(response);
      renderResult(result, request);
      status.textContent = 'MWL query completed.';
    } catch {
      status.textContent = 'MWL query failed.';
    } finally {
      active = false;
      run.disabled = false;
    }
  });

  clearRendered();
  return {
    getComparisonSnapshot() {
      if (!state.result) return null;
      return structuredClone({ generation, request: state.request, result: state.result, selectedIndex: state.selectedIndex });
    },
    onComparisonSourceChange(listener) { comparisonListeners.add(listener); return () => comparisonListeners.delete(listener); }
  };
}
