const guide = (purpose, steps, results, tip) => ({ purpose, steps, results, tip });

export const WORKSPACE_TOOLS = Object.freeze({
  inspect: [
    { id: 'hl7-inspector', name: 'HL7 Message Inspector', description: 'Inspect and edit one loaded HL7 message with raw and structured views.', example: 'An ORM message contains an unexpected procedure value and the analyst needs its exact OBR path.', guide: guide('Shows one explicitly selected HL7 message in raw and structured views and provides bounded editing tools.', ['Load or paste synthetic HL7 messages from Home.', 'Select one message from the catalog.', 'Use Raw or Structure tree to inspect fields.', 'Apply an edit only after reviewing the selected path and value.'], 'Findings identify local structural concerns; they do not prove how a receiving system processed the message.', 'Use the structure tree to confirm exact segment, field, repetition, and component provenance before editing.') },
    { id: 'dicom-inspector', name: 'DICOM File Inspector', description: 'Inspect metadata from one local DICOM Part 10 file without rendering pixels.', example: 'A synthetic CT object reports an unexpected SOP Class or Transfer Syntax.', guide: guide('Reads metadata from one local DICOM Part 10 file in browser memory without rendering pixel data.', ['Choose an authorized local DICOM file.', 'Review the local-read status and summary.', 'Search by tag, keyword, or name.', 'Review the redacted troubleshooting copy before sharing it.'], 'Displayed tags describe the selected object; missing or unfamiliar metadata does not by itself establish a workflow failure.', 'Compare SOP Class, Transfer Syntax, and modality first when troubleshooting interoperability.') },
  ],
  diagnostics: [
    { id: 'profiles-baselines', name: 'Endpoint Profiles / Baselines', description: 'Manage nonclinical endpoint profiles and compare current technical evidence with a known-good result.', example: 'A test PACS endpoint changed ports and its current connectivity differs from last week’s baseline.', guide: guide('Stores technical endpoint settings locally and compares eligible diagnostic evidence with an explicit known-good baseline.', ['Load or create a nonclinical endpoint profile.', 'Review its type, host, port, environment, and protocol fields.', 'Run the relevant diagnostic from its tool page.', 'Save or load a known-good baseline only when appropriate.', 'Generate a qualified evidence summary if useful.'], 'A baseline difference identifies changed technical evidence; it does not establish clinical impact or root cause.', 'Keep profile notes nonclinical and verify environment and port before each live diagnostic.') },
    { id: 'dicom-connectivity', name: 'DICOM Connectivity', description: 'Test DNS, TCP, DICOM association, and C-ECHO for one authorized endpoint.', example: 'A modality can resolve the PACS host but Verification is rejected for the configured Called AE.', guide: guide('Runs one explicit layered TCP or DICOM Verification check against an authorized endpoint.', ['Enter or verify host, port, and timeout.', 'For C-ECHO, verify Calling and Called AE Titles.', 'Choose TCP-only or DICOM C-ECHO explicitly.', 'Review each reported protocol layer.'], 'TCP success proves connectivity only. C-ECHO success confirms DICOM Verification, not storage, MWL, or Query/Retrieve.', 'When association fails after TCP succeeds, verify AE Titles and the peer’s configured presentation context.') },
    { id: 'mwl', name: 'Modality Worklist', description: 'Query an authorized MWL SCP and inspect returned scheduled procedures.', example: 'An MRI order exists in the RIS but does not appear on the modality worklist.', guide: guide('Runs one explicit DICOM MWL C-FIND and displays layered evidence plus bounded in-memory results.', ['Select or enter an authorized DICOM endpoint.', 'Enter at least one visible query criterion.', 'Run MWL C-FIND explicitly.', 'Review protocol layers, match count, result rows, and the selected-item inspector.', 'Clear patient-bearing results when finished.'], 'A successful zero-match query means the SCP responded successfully but no item matched the visible criteria; it is not an MWL failure.', 'Start with the smallest useful criterion set, then check modality, station AE, location, and date filters.') },
    { id: 'orm-mwl-comparison', name: 'ORM ↔ MWL Comparison', description: 'Compare one explicitly selected ORM order group with a selected MWL item or successful zero-match query context.', example: 'The upstream ORM says MR while the selected worklist item reports CT.', guide: guide('Builds a session-only, provenance-preserving comparison from explicit HL7 and MWL evidence.', ['Select an eligible ORM in the HL7 inspector.', 'Choose its structural order group when required.', 'Optionally establish the group-local accession source.', 'Select a worklist row or use a successful zero-match query context.', 'Run Compare ORM to MWL explicitly.'], 'Results are conservative evidence states and qualified guidance, not automatic matching or proof of root cause.', 'Resolve ambiguous HL7 source provenance before treating an identifier or procedure difference as authoritative.') },
    { id: 'dicom-query-retrieve', name: 'DICOM Query / Retrieve', description: 'Query one authorized PACS for matching studies without retrieving or modifying them.', example: 'An accession is complete upstream, but the analyst needs to confirm whether a matching study exists in PACS.', guide: guide('Runs one explicit read-only Study Root C-FIND with visible narrowing criteria and bounded session-only results.', ['Select or enter one authorized DICOM endpoint.', 'Enter at least one visible study criterion.', 'Run Study C-FIND explicitly.', 'Review protocol layers and matching study rows.', 'Inspect a selected row, then clear patient-bearing results.'], 'Successful zero matches means the PACS query completed but no study matched the visible criteria; it is not a connectivity failure. Matching rows are evidence of returned study records, not retrieval.', 'Start with the smallest exact criterion supported by the workflow, such as accession or Study Instance UID, and verify the Called AE before running.') },
    { id: 'http-tls', name: 'HTTP / TLS', description: 'Inspect DNS, TCP, TLS certificate, and HTTP status evidence for one authorized URL.', example: 'A health endpoint resolves and negotiates TLS but returns an unexpected redirect.', guide: guide('Runs one explicit layered HTTP or HTTPS diagnostic without retaining response bodies.', ['Enter an authorized HTTP or HTTPS target.', 'Review the timeout.', 'Run the diagnostic explicitly.', 'Inspect DNS, TCP, TLS, certificate, and HTTP evidence.'], 'A successful lower layer does not establish success at a later layer; redirects are reported but not followed.', 'Check certificate identity and validity separately from the returned HTTP status.') },
    { id: 'hl7-mllp', name: 'HL7 / MLLP', description: 'Check safe MLLP reachability or send one explicitly requested synthetic HL7 test message.', example: 'The interface port accepts TCP but the synthetic message receives an application-error ACK.', guide: guide('Checks TCP reachability with zero application bytes or sends exactly one generated synthetic HL7 test message.', ['Enter an authorized host, port, and timeout.', 'Choose safe reachability or synthetic send explicitly.', 'For synthetic send, verify the destination first.', 'Review DNS, TCP, MLLP, ACK, and application layers.'], 'TCP success does not verify an HL7 receiver. A correlated AA acknowledges the test message but does not prove downstream clinical processing.', 'Use safe reachability first when you are not authorized to send even synthetic application data.') },
  ],
});

const labels = { inspect: 'Inspect', diagnostics: 'Diagnostics' };
const direct = new Set(['home', 'compare', 'validate', 'case', 'send', 'history']);

export function createWorkspaceNavigation(root) {
  let state = { mode: 'DIRECT_WORKSPACE', workspaceId: 'home', toolId: null }; let guideInvoker = null;
  const one = selector => root.querySelector(selector);
  const all = selector => [...root.querySelectorAll(selector)];
  function element(tag, text, className) { const node = root.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
  function hideAllTools() { all('[data-tool-panel]').forEach(node => { node.hidden = true; }); }
  function showWorkspace(workspaceId) {
    const known = direct.has(workspaceId) || Object.hasOwn(WORKSPACE_TOOLS, workspaceId);
    const selected = known ? workspaceId : 'home';
    all('[data-workspace]').forEach(node => { node.hidden = node.dataset.workspace !== selected; });
    closeGuide(); hideAllTools();
    if (WORKSPACE_TOOLS[selected]) {
      one(`#${selected}-landing`).hidden = false; one(`#${selected}-tool-view`).hidden = true;
      state = { mode: 'WORKSPACE_LANDING', workspaceId: selected, toolId: null };
    } else state = { mode: 'DIRECT_WORKSPACE', workspaceId: selected, toolId: null };
    return known;
  }
  function openTool(workspaceId, toolId) {
    const tool = WORKSPACE_TOOLS[workspaceId]?.find(item => item.id === toolId);
    const panel = tool && one(`[data-tool-panel="${toolId}"]`);
    if (!tool || !panel) { showWorkspace(workspaceId); return false; }
    showWorkspace(workspaceId); one(`#${workspaceId}-landing`).hidden = true; one(`#${workspaceId}-tool-view`).hidden = false;
    hideAllTools(); panel.hidden = false;
    one(`#${workspaceId}-breadcrumb`).textContent = `${labels[workspaceId]} > ${tool.name}`;
    const heading = one(`#${workspaceId}-tool-heading`); heading.textContent = tool.name; heading.focus();
    state = { mode: 'TOOL_OPEN', workspaceId, toolId }; return true;
  }
  function backToWorkspace(workspaceId) { showWorkspace(workspaceId); one(`#${workspaceId}-landing`)?.focus?.(); }
  function openGuide(workspaceId, toolId, invoker) {
    const tool = WORKSPACE_TOOLS[workspaceId]?.find(item => item.id === toolId); if (!tool) return false;
    guideInvoker = invoker ?? null; one('#tool-guide-title').textContent = tool.name; one('#tool-guide-purpose').textContent = tool.guide.purpose;
    one('#tool-guide-example').textContent = tool.example; const steps = one('#tool-guide-steps'); steps.replaceChildren();
    for (const value of tool.guide.steps) { const item = root.createElement('li'); item.textContent = value; steps.append(item); }
    one('#tool-guide-results').textContent = tool.guide.results; one('#tool-guide-tip').textContent = tool.guide.tip; one('#tool-guide-dialog').showModal(); return true;
  }
  function closeGuide() { const dialog = one('#tool-guide-dialog'); if (dialog?.open) dialog.close(); const target = guideInvoker; guideInvoker = null; target?.focus?.(); }
  for (const [workspaceId, tools] of Object.entries(WORKSPACE_TOOLS)) {
    const host = one(`#${workspaceId}-tool-host`); if (!host) continue; host.replaceChildren();
    for (const tool of tools) {
      const card = element('article', undefined, 'tool-card');
      const title = element('h2', tool.name); const description = element('p', tool.description, 'tool-description');
      const example = element('p', undefined, 'tool-example'); example.append(element('strong', 'Example: '), root.createTextNode ? root.createTextNode(tool.example) : element('span', tool.example));
      const actions = element('div', undefined, 'tool-card-actions');
      const quick = element('button', '? Quick Guide', 'tool-guide-button'); quick.type = 'button'; quick.setAttribute('aria-label', `Quick Guide for ${tool.name}`);
      const open = element('button', 'Open Tool →', 'tool-open-button'); open.type = 'button'; open.setAttribute('aria-label', `Open ${tool.name}`);
      quick.addEventListener('click', () => openGuide(workspaceId, tool.id, quick)); open.addEventListener('click', () => openTool(workspaceId, tool.id));
      actions.append(quick, open); card.append(title, description, example, actions); host.append(card);
    }
    one(`#${workspaceId}-back`)?.addEventListener('click', () => backToWorkspace(workspaceId));
  }
  one('#tool-guide-close')?.addEventListener('click', closeGuide);
  one('#tool-guide-dialog')?.addEventListener('close', () => { const target = guideInvoker; guideInvoker = null; target?.focus?.(); });
  return { showWorkspace, openTool, backToWorkspace, openGuide, closeGuide, getState: () => ({ ...state }) };
}
