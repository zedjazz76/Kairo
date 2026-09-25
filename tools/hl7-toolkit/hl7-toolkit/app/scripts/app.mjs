import { createApi } from './api.mjs';
import { createWorkbenchState, mountWorkbench } from './workbench.mjs';
import { mountSend } from './send-ui.mjs';
import { mountDicom } from './dicom-ui.mjs';
import { mountDiagnostics } from './diagnostics-ui.mjs';
import { mountMwl } from './mwl-ui.mjs';
import { mountStudyQuery } from './study-query-ui.mjs';
import { mountCase } from './case-ui.mjs';
import { mountWorkflowComparison } from './workflow-comparison-ui.mjs';
import { createWorkspaceNavigation } from './workspace-navigation.mjs';
import { mountImageSanitize } from './image-sanitize-ui.mjs';
import { mountOperatorKit } from './operator-kit-ui.mjs';
import { createSanitizerSession } from './sanitizer.mjs';
import { createSegmentHelpIndex } from './segment-help.mjs';

const token = new URLSearchParams(location.search).get('token') || new URLSearchParams(location.hash.slice(1)).get('session') || '';
const status = document.querySelector('#service-status');
if (!token) {
  status.textContent = 'Open the toolkit using “Open HL7 Toolkit.cmd” so this page receives its local session key.';
  status.classList.add('error');
} else {
  history.replaceState(null, '', '/#session=' + encodeURIComponent(token));
  try {
    const api = createApi({ token, sessionId: crypto.randomUUID() });
    await api.request('/api/session');
    const response = await fetch('/definitions/phi-rules.v1.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('POLICY_NOT_AVAILABLE');
    const rules = await response.json();
    const fieldResponse = await fetch('/definitions/basic-fields.v1.json', { cache: 'no-store' });
    if (!fieldResponse.ok) throw new Error('LABELS_NOT_AVAILABLE');
    const basicFields = await fieldResponse.json();
    const segmentResponse = await fetch('/definitions/hl7-segments.v1.json', { cache: 'no-store' });
    if (!segmentResponse.ok) throw new Error('SEGMENT_DEFINITIONS_NOT_AVAILABLE');
    const segmentDefinitions = await segmentResponse.json();
    const validationResponse = await fetch('/definitions/kairo-validation-baseline.v1.json', { cache: 'no-store' });
    if (!validationResponse.ok) throw new Error('VALIDATION_PROFILE_NOT_AVAILABLE');
    const validationPack = await validationResponse.json();
    const navigation = createWorkspaceNavigation(document);
    const sanitizer = createSanitizerSession(rules);
    const segmentHelp = createSegmentHelpIndex(segmentDefinitions);
    const controller = mountWorkbench(document, createWorkbenchState(), { api, rules, token, basicFields, segmentDefinitions, validationPack, navigation });
    mountImageSanitize(document);
    mountOperatorKit(document, { sanitizer, basicFields, segmentHelp, api });
    await mountSend(controller, api);
    mountDicom(document);
    mountCase(document);
    mountDiagnostics(document, api);
    const mwlController = mountMwl(document, api);
    mountStudyQuery(document, api);
    mountWorkflowComparison(document, { hl7Source: controller, mwlSource: mwlController });
  } catch {
    status.textContent = 'The protected local helper or policy is unavailable. Close the helper window and launch the toolkit again.';
    status.classList.add('error');
  }
}
