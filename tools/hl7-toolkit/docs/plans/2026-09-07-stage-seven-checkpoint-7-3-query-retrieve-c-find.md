# Stage Seven Checkpoint 7.3 — Read-Only Study Root C-FIND Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, sequentially and without subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one explicit, bounded, read-only Study Root C-FIND workflow that answers whether matching study evidence is present in one authorized PACS.

**Architecture:** Refactor only reusable UL/DIMSE mechanics in the accepted Checkpoint 7.1 engine into an internal fixed-profile C-FIND core. Preserve the existing MWL public adapter and add a separately typed Study Root adapter, browser model, controller, and focused Diagnostics tool.

**Tech Stack:** Windows PowerShell 5.1, in-memory C# via `Add-Type`, `TcpClient`, browser ES modules, Node.js `node:test`, controlled loopback DICOM SCP.

**Spec:** `tools/hl7-toolkit/docs/specs/2026-09-07-stage-seven-checkpoint-7-3-query-retrieve-c-find.md`

## Global Constraints

- Implement Checkpoint 7.3 only; do not start Patient Root, retrieval, Checkpoints 7.4/7.5, or Stage 8.
- Work inline in the current `kairo-v1` tree without subagents, parallel agents, worktrees, or commits before manual acceptance.
- Preserve the public Checkpoint 7.1 MWL route, request/result shapes, classifications, byte behavior, cancellation behavior, and browser workflow.
- Use only Study Root FIND UID `1.2.840.10008.5.1.4.1.2.2.1` with `QueryRetrieveLevel=STUDY`.
- Require one visible narrowing criterion. Never default, infer, broaden, retry, discover, scan, poll, retrieve, modify, or persist.
- Retain at most 100 results and issue correlated C-CANCEL at the cap while preserving retained results across terminal races and cancellation failures.
- Returned criteria/results/PHI remain in active browser memory only and never enter logs, console, URLs, profiles, baselines, cases, history, handoffs, telemetry, exports, or disk.
- Helper closure stops service access but does not claim to erase already-rendered browser content.
- Each production change follows a witnessed RED → minimal GREEN cycle.

## File Structure

- Modify `hl7-toolkit/service/DicomQueryDiagnostics.cs`: introduce the shared fixed-profile C-FIND mechanics, retain `MwlQueryClient`, and add typed Study Root request/result/client projections.
- Create `hl7-toolkit/service/HL7Toolkit.StudyQuery.psm1`: strict allowlist validation and Study Root runtime adapter.
- Modify `hl7-toolkit/service/Start-HL7Toolkit.ps1` and `hl7-toolkit/service/HL7Toolkit.Http.psm1`: load the adapter and expose authenticated POST-only `/api/dicom/studies/find`.
- Create `hl7-toolkit/app/scripts/study-query-model.mjs`: strict visible-request construction, result projection, inspector rows, and fresh empty state.
- Create `hl7-toolkit/app/scripts/study-query-ui.mjs`: explicit Run/Clear, profile fill, layered evidence, seven-column result table, and selected-row inspector.
- Modify `hl7-toolkit/app/scripts/dicom-core.mjs`: add only approved Study Root tag definitions.
- Modify `hl7-toolkit/app/scripts/workspace-navigation.mjs`, `app.mjs`, and `index.html`: add one Diagnostics card and one mounted focused tool panel.
- Create `tests/hl7-toolkit/study-query-model.test.mjs`, `study-query-ui.test.mjs`, and `study-query.test.mjs`.
- Create `tests/hl7-toolkit/helpers/study-query-peer.mjs` by extending the controlled peer protocol vocabulary without changing MWL fixtures.
- Modify focused dictionary/navigation/privacy/contract tests and verification documentation only where the new tool requires it.

---

### Task 1: Pure Study Query Request and Result Model

**Files:**
- Create: `tools/hl7-toolkit/hl7-toolkit/app/scripts/study-query-model.mjs`
- Create: `tools/hl7-toolkit/tests/hl7-toolkit/study-query-model.test.mjs`
- Modify: `tools/hl7-toolkit/hl7-toolkit/app/scripts/dicom-core.mjs`
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/dicom-core.test.mjs`

**Interfaces:**
- Produces `buildStudyQueryRequest(values)`, `normalizeStudyQueryResult(response)`, `studyInspectorRows(item)`, and `emptyStudyQueryState()`.
- Request schema is exactly `{schema:'kairo.study-query.v1',host,port,callingAe,calledAe,timeoutMs,criteria}` with allowlisted `accessionNumber`, `patientId`, `studyInstanceUid`, `studyDate`, `studyDateRange`, and `modalitiesInStudy`.

- [ ] Write tests proving blank criteria throw `STUDY_CRITERION_REQUIRED`; date, closed range, UID, endpoint, length, wildcard, whitespace, unknown-property, array/object, and visible-key rules are enforced; no criterion is synthesized.
- [ ] Run `node --test tests/hl7-toolkit/study-query-model.test.mjs` and verify RED because the module is absent.
- [ ] Implement the minimal strict builder. Convert visible ISO dates to DA only; reject `*` and `?`; preserve exact case; omit empty approved criteria; reject all unknown properties.
- [ ] Add failing projection tests for 101-result rejection, original-value preservation, allowlisted inspector provenance, unsupported markers, and a fresh PHI-free empty state.
- [ ] Add Study Root definitions for `(0008,0005)`, `(0008,0050)`, `(0008,0061)`, `(0008,0090)`, `(0008,0020)`, `(0008,0030)`, `(0008,1030)`, `(0010,0010)`, `(0010,0020)`, `(0020,000D)`, `(0020,1206)`, and `(0020,1208)` using the established provenance format.
- [ ] Implement safe allowlisted result/inspector projection using original strings and text-safe values only.
- [ ] Run `node --test tests/hl7-toolkit/study-query-model.test.mjs tests/hl7-toolkit/dicom-core.test.mjs` and verify GREEN.

### Task 2: Strict Study Query Service Boundary

**Files:**
- Create: `tools/hl7-toolkit/hl7-toolkit/service/HL7Toolkit.StudyQuery.psm1`
- Modify: `tools/hl7-toolkit/hl7-toolkit/service/Start-HL7Toolkit.ps1`
- Modify: `tools/hl7-toolkit/hl7-toolkit/service/HL7Toolkit.Http.psm1`
- Create: `tools/hl7-toolkit/tests/hl7-toolkit/study-query.test.mjs`

**Interfaces:**
- Produces `Assert-KairoStudyQueryPayload -Payload`, `Invoke-KairoStudyQuery -Payload`, and authenticated POST-only `/api/dicom/studies/find`.
- The adapter maps only allowlisted input into `Kairo.Diagnostics.StudyQueryRequest`; errors expose generic `STUDY_*` codes and never values.

- [ ] Write protected-route tests for authentication, POST-only handling, body/schema/unknown-field rejection, every invalid criterion, empty criteria, and zero loopback connections for local rejection.
- [ ] Run `node --test tests/hl7-toolkit/study-query.test.mjs` and verify RED with `NOT_FOUND`.
- [ ] Implement strict PowerShell validation mirroring the browser boundary and import it at startup. Add the route without changing any existing branch.
- [ ] Until the typed client exists, return safe `STUDY_RUNTIME_UNAVAILABLE` for a valid request.
- [ ] Rerun the focused route tests and verify GREEN.

### Task 3: Shared C-FIND Core and Study Root Adapter

**Files:**
- Modify: `tools/hl7-toolkit/hl7-toolkit/service/DicomQueryDiagnostics.cs`
- Modify: `tools/hl7-toolkit/hl7-toolkit/service/HL7Toolkit.StudyQuery.psm1`
- Create: `tools/hl7-toolkit/tests/hl7-toolkit/helpers/study-query-peer.mjs`
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/study-query.test.mjs`
- Verify unchanged: `tools/hl7-toolkit/tests/hl7-toolkit/mwl-query.test.mjs`

**Interfaces:**
- Internal core consumes a fixed model profile containing SOP UID, transfer syntaxes, identifier bytes, response projector, and result/layer callbacks; it does not accept browser-provided UIDs or tags.
- Produces `StudyQueryRequest`, `StudyItem`, `StudyQueryResult`, and `StudyQueryClient.Run(StudyQueryRequest)` while retaining every existing `Mwl*` type and member.

- [ ] Add failing controlled-peer tests proving the association requests only Study Root FIND, accepts proposed Explicit or Implicit VR Little Endian, sends one C-FIND with `QueryRetrieveLevel=STUDY`, includes exactly the visible matching keys plus approved empty return keys, and performs one selected-address connection with no retry.
- [ ] Run the focused Study Query protocol tests and verify RED because `StudyQueryClient` is unavailable.
- [ ] Extract shared PDU framing, selected-address connection, association, DIMSE command/PDV correlation, timeout, bounds, status, and C-CANCEL mechanics behind fixed internal profiles. Keep the MWL façade and its accepted implicit-transfer behavior unchanged.
- [ ] Implement Study Root request encoding for both accepted transfer syntaxes and typed allowlisted study response decoding for those syntaxes.
- [ ] Add failing tests for zero/one/multiple matches, `0xFF01`, actual terminal status, association reject, presentation-context reject, timeout/failure, wrong message/context/SOP/command, fragmented PDVs, malformed/oversized PDU/command/dataset/value/count, and unsupported syntax.
- [ ] Implement conservative classifications and fixed bounds from the spec; discard unknown value bytes and never include raw payloads in results/errors.
- [ ] Add failing charset tests for default/ISO_IR 6, ISO_IR 100, ISO_IR 192, malformed text, and unsupported charset safe markers without U+FFFD or canary leakage.
- [ ] Implement the approved strict decoders and metadata-only warnings.
- [ ] Add failing 99/100/101+, C-CANCEL correlation, terminal race, cancel timeout/send failure, and association-close tests.
- [ ] Implement the 100-result cap and preserve retained results with `SUCCESS_TRUNCATED` and separate cancellation evidence.
- [ ] Run `node --test tests/hl7-toolkit/study-query.test.mjs tests/hl7-toolkit/mwl-query.test.mjs`; verify Study Query GREEN and all MWL tests unchanged.

### Task 4: Focused Browser Tool and Diagnostics Navigation

**Files:**
- Create: `tools/hl7-toolkit/hl7-toolkit/app/scripts/study-query-ui.mjs`
- Create: `tools/hl7-toolkit/tests/hl7-toolkit/study-query-ui.test.mjs`
- Modify: `tools/hl7-toolkit/hl7-toolkit/app/scripts/workspace-navigation.mjs`
- Modify: `tools/hl7-toolkit/hl7-toolkit/app/scripts/app.mjs`
- Modify: `tools/hl7-toolkit/hl7-toolkit/app/index.html`
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/workspace-navigation.test.mjs`
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/ui-contract.test.mjs`

**Interfaces:**
- Produces `mountStudyQuery(root, api)` with no persistence dependency.
- Adds Diagnostics tool id `dicom-query-retrieve`, one card/guide, and one `[data-tool-panel="dicom-query-retrieve"]` mounted once.

- [ ] Write UI tests proving all criteria start blank, no call occurs before explicit Run, invalid/all-empty input makes zero API calls, busy Run is suppressed, and explicit profile Load/Fill never runs a query.
- [ ] Run `node --test tests/hl7-toolkit/study-query-ui.test.mjs` and verify RED because the controller is absent.
- [ ] Implement the form/controller with endpoint inputs, exact criteria, explicit Run/Clear, and generic non-PHI failure text.
- [ ] Add failing rendering tests for DNS/TCP/association/C-FIND/matches, actual status, successful zero matches, warnings/truncation, seven exact table columns, selected TAG/KEYWORD/VALUE/DEFINITION rows, markup-safe text, and long-value behavior.
- [ ] Implement text-node-only rendering and selected-row inspection; do not log or store response content outside controller state.
- [ ] Add failing Clear/End Session tests proving retained objects, selected row, request snapshot, warnings/layers, and DOM PHI are removed; assert accurate helper-close guidance and no lifecycle polling/signaling.
- [ ] Implement a fresh empty state and register Q/R clearing with the existing End Session boundary without changing helper behavior.
- [ ] Add failing navigation tests for the exact seven-card Diagnostics inventory, complete concise guide, focused open/back/breadcrumb, preserved uncleared state, and no traffic from guide/card opening.
- [ ] Add the shared selector entry, guide, mounted panel, and application mount. Preserve all direct workspaces and Quick Sanitize.
- [ ] Run `node --test tests/hl7-toolkit/study-query-model.test.mjs tests/hl7-toolkit/study-query-ui.test.mjs tests/hl7-toolkit/workspace-navigation.test.mjs tests/hl7-toolkit/ui-contract.test.mjs` and verify GREEN.

### Task 5: Privacy, Documentation, and Final Automated Verification

**Files:**
- Modify: `tools/hl7-toolkit/README-FIRST.md`
- Modify: `tools/hl7-toolkit/hl7-toolkit/README.md`
- Modify: `tools/hl7-toolkit/hl7-toolkit/VERIFICATION.md`
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/integrated-privacy.test.mjs`
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/http-safety.test.mjs`

- [ ] Add failing static/privacy assertions that Q/R criteria/results cannot reach persistence APIs, logs, console, URLs, exports, DOM attributes, or existing profile/case/history/handoff models.
- [ ] Run the focused privacy tests and verify RED on the missing Q/R boundary assertions.
- [ ] Add only the minimal integration seam or documentation required to make the boundary explicit; do not add persistence or helper lifecycle mechanisms.
- [ ] Update verification documentation with the exact controlled synthetic SCP and real Windows steps, marking automated implementation as pending manual acceptance.
- [ ] Run focused Study Query tests, full MWL regression, affected browser/navigation/privacy suites, JavaScript syntax checks, the existing Windows service probe, and `git diff --check`.
- [ ] Review `git status` and the complete diff for Patient Root/retrieval commands, hidden criteria, retry/polling, PHI sinks, unrelated refactoring, and Stage 1–7.2 behavior changes.
- [ ] Stop with the complete working tree uncommitted for real Windows manual acceptance. Do not start Checkpoint 7.4.
