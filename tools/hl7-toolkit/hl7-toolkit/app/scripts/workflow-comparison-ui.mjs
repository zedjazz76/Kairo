import { parseHl7 } from './hl7-parser.mjs';
import { inspectOrmMessage, projectOrmGroup } from './orm-workflow-adapter.mjs';
import { projectMwlTarget } from './mwl-workflow-adapter.mjs';
import { compareOrmToMwl } from './workflow-comparison-model.mjs';

export function mountWorkflowComparison(root, { hl7Source, mwlSource }) {
  const $ = selector => root.querySelector(selector);
  const state = { ormSnapshot: null, ormInspection: null, ormSource: null, groupId: '', accessionSourcePath: '', mwlTarget: null, comparison: null, sourceTokens: { orm: 0, mwl: 0 } };
  const option = (value, label) => { const node = root.createElement('option'); node.value = value; node.textContent = label; return node; };
  const setStatus = value => { $('#workflow-status').textContent = value; };
  const clearOutput = () => {
    state.comparison = null;
    $('#workflow-comparison-rows').replaceChildren();
    $('#workflow-concepts').replaceChildren();
    $('#workflow-observed').textContent = 'OBSERVED: No comparison has been run.';
    $('#workflow-boundary').textContent = 'LIKELY BOUNDARY: Not evaluated.';
    $('#workflow-missing').textContent = 'MISSING EVIDENCE: Not evaluated.';
    $('#workflow-next').textContent = 'NEXT CHECK: Not evaluated.';
  };
  const selectGroup = groupId => {
    state.groupId = groupId;
    state.ormSource = projectOrmGroup(state.ormInspection, groupId);
    state.accessionSourcePath = '';
    $('#workflow-accession-source').replaceChildren(option('', 'Not established'), ...state.ormSource.accessionChoices.map(choice => option(choice.path, choice.path)));
    $('#workflow-accession-source').value = '';
    $('#workflow-order-group-summary').textContent = `Order group: ${state.ormSource.segmentOccurrences.join(' + ')}`;
    clearOutput();
  };
  const render = result => {
    const cell = value => { const node = root.createElement('td'); node.textContent = value ?? ''; return node; };
    $('#workflow-comparison-rows').replaceChildren(...result.rows.map(item => {
      const row = root.createElement('tr');
      row.append(cell(item.concept), cell(item.hl7Source), cell(item.hl7Value), cell(item.mwlSource), cell(item.mwlValue), cell(item.state));
      return row;
    }));
    $('#workflow-concepts').replaceChildren(...result.concepts.map(item => { const node = root.createElement('p'); node.textContent = `${item.concept}: ${item.state} · ${item.explanation}`; return node; }));
    $('#workflow-observed').textContent = `OBSERVED: ${result.guidance.observed.join(' ')}`;
    $('#workflow-boundary').textContent = `LIKELY BOUNDARY: ${result.guidance.likelyBoundary}`;
    $('#workflow-missing').textContent = `MISSING EVIDENCE: ${result.guidance.missingEvidence}`;
    $('#workflow-next').textContent = `NEXT CHECK: ${result.guidance.nextChecks.join(' ')}`;
  };

  $('#workflow-use-orm').addEventListener('click', () => {
    const snapshot = hl7Source.getSelectedMessageSnapshot();
    if (!snapshot) { setStatus('ORM_REQUIRED: Explicitly select one eligible ORM message.'); return; }
    const inspection = inspectOrmMessage(parseHl7(snapshot.text));
    if (inspection.eligibility !== 'ELIGIBLE') { state.ormSnapshot = null; state.ormInspection = null; state.ormSource = null; setStatus('Selected HL7 message is not eligible for ORM-to-MWL comparison. Reason: ORM_REQUIRED'); clearOutput(); return; }
    state.ormSnapshot = snapshot; state.ormInspection = inspection; state.sourceTokens.orm = snapshot.generation; state.groupId = ''; state.ormSource = null; state.accessionSourcePath = ''; clearOutput();
    $('#workflow-orm-summary').textContent = `Selected HL7 ORM: message ${Number(snapshot.index) + 1} · MSH-9 ${inspection.msh9}`;
    $('#workflow-order-group').replaceChildren(option('', inspection.groups.length > 1 ? 'Select one order group' : inspection.groups[0].segmentOccurrences.join(' + ')), ...inspection.groups.map(group => option(group.id, `${group.id}: ${group.segmentOccurrences.join(' + ')}`)));
    if (inspection.ambiguity) { setStatus('ORDER_GROUP_AMBIGUOUS: Structural order grouping is unresolved.'); return; }
    if (inspection.groups.length === 1) selectGroup(inspection.groups[0].id);
    else setStatus('ORDER_GROUP_SELECTION_REQUIRED: Select one structural order group.');
  });
  $('#workflow-order-group').addEventListener('change', event => { if (event.target.value) { selectGroup(event.target.value); setStatus('Order group selected. Establish accession if applicable, then select an MWL target.'); } });
  $('#workflow-accession-source').addEventListener('change', event => { state.accessionSourcePath = event.target.value; clearOutput(); setStatus(state.accessionSourcePath ? `HL7 accession source selected: ${state.accessionSourcePath}` : 'ACCESSION_SOURCE_NOT_ESTABLISHED: Accession remains NOT_COMPARABLE.'); });
  $('#workflow-use-mwl').addEventListener('click', () => {
    const projected = projectMwlTarget(mwlSource.getComparisonSnapshot());
    if (projected.state !== 'READY') { state.mwlTarget = null; setStatus(`${projected.state}: Select or run an eligible MWL result.`); clearOutput(); return; }
    state.mwlTarget = projected; state.sourceTokens.mwl = projected.generation; clearOutput();
    $('#workflow-mwl-target').textContent = projected.mode === 'SELECTED_ITEM_COMPARISON' ? 'MWL comparison target: Selected worklist item' : 'MWL comparison target: Successful zero-match query context';
    setStatus('Sources selected. Choose Compare ORM to MWL explicitly.');
  });
  $('#workflow-compare').addEventListener('click', () => {
    if (!state.ormSource) { setStatus('ORDER_GROUP_SELECTION_REQUIRED: Select an eligible ORM order group.'); return; }
    if (!state.mwlTarget) { setStatus('MWL_RESULT_REQUIRED: Select an eligible MWL target.'); return; }
    const currentOrm = hl7Source.getSelectedMessageSnapshot(); const currentMwl = mwlSource.getComparisonSnapshot();
    if (currentOrm?.generation !== state.sourceTokens.orm || currentMwl?.generation !== state.sourceTokens.mwl) { clearOutput(); setStatus('SOURCE_STALE: Source evidence changed. Select the source again.'); return; }
    state.comparison = compareOrmToMwl({ orm: state.ormSource, mwl: state.mwlTarget, accessionSourcePath: state.accessionSourcePath });
    render(state.comparison); setStatus('ORM-to-MWL comparison completed from the explicitly selected sources.');
  });
  $('#workflow-clear').addEventListener('click', () => {
    state.accessionSourcePath = ''; state.mwlTarget = null; state.sourceTokens.mwl = 0;
    $('#workflow-accession-source').value = ''; $('#workflow-mwl-target').textContent = 'MWL comparison target: None selected'; clearOutput(); setStatus('Comparison cleared. Selected ORM order group remains available.');
  });
  hl7Source.onSelectedMessageChange?.(() => { state.ormSnapshot = null; state.ormInspection = null; state.ormSource = null; state.groupId = ''; state.accessionSourcePath = ''; clearOutput(); setStatus('COMPARISON_INVALIDATED: The selected HL7 source changed.'); });
  mwlSource.onComparisonSourceChange?.(() => { state.mwlTarget = null; state.sourceTokens.mwl = 0; clearOutput(); $('#workflow-mwl-target').textContent = 'MWL comparison target: None selected'; setStatus('COMPARISON_INVALIDATED: The MWL source changed.'); });
  clearOutput();
  return { clear: () => $('#workflow-clear').listeners?.click?.(), getState: () => structuredClone(state) };
}
