# Stage Seven Checkpoint 7.1 — DMWL C-FIND Implementation Plan

**Status — September 7, 2026:** Tasks 1–7 are complete. Windows results: MWL protocol 18/18 and endpoint diagnostics 7/7. Affected browser results: 35/35. Four syntax checks, the standard-user service probe, and `git diff --check` passed. Final real Windows acceptance passed against the controlled synthetic MWL SCP, including the corrected result/inspector alignment. Checkpoint 7.1 is complete; Checkpoint 7.2 has not started.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, sequentially and without subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one explicit, bounded DICOM Modality Worklist C-FIND workflow to the existing Diagnostics workspace, with layered protocol evidence, at most 100 session-only results, and a provenance-controlled nested tag inspector.

**Architecture:** Add a separate authenticated MWL route and PowerShell adapter backed by a dependency-free C# query engine compiled in memory. Keep request validation/result projection in a pure browser model and MWL DOM behavior in its own controller; mount it inside the existing Diagnostics workspace without changing `EndpointDiagnostics.cs` or accepted C-ECHO behavior.

**Tech Stack:** Windows PowerShell 5.1, in-memory C# via `Add-Type`, ordinary `TcpClient` user-mode networking, browser ES modules, Node.js `node:test`, controlled synthetic loopback DICOM SCP.

**Spec:** `tools/hl7-toolkit/docs/specs/2026-09-06-stage-seven-dicom-workflow-diagnostics.md`

## Global Constraints

- Scope is Checkpoint 7.1 — DMWL C-FIND only. Do not plan or implement Checkpoints 7.2–7.5 or Stage Eight.
- Execute one task at a time inline. Do not use subagents, parallel execution, background workers, or extra worktrees.
- Preserve `EndpointDiagnostics.cs`, C-ECHO behavior, all Stage 1–6 routes, schemas, workspaces, and privacy controls.
- Add no third-party DICOM dependency. Use only the existing PowerShell/.NET/browser runtime.
- Target one explicitly configured endpoint, select one resolved address, open one association, and issue one explicit C-FIND per click.
- Require at least one visible narrowing criterion; default Scheduled Date visibly to the workstation's current local date.
- Never retry, broaden, relax, discover, scan, poll, remediate, elevate, install, capture, or modify the workstation.
- Retain/display at most 100 pending matches and send correlated C-CANCEL immediately after retaining match 100.
- Keep all MWL query criteria and results session-only. Patient Name/ID never enter disk, profiles, baselines, cases, evidence summaries, handoffs, logs, console output, telemetry, or errors.
- Tests use synthetic values and controlled loopback peers only.
- Every production change follows RED → GREEN → REFACTOR. Commit only after that task's focused tests pass.

## File structure

- Create `hl7-toolkit/service/DicomQueryDiagnostics.cs`: bounded association, DIMSE C-FIND/C-CANCEL, dataset codec, charset decoder, structured result types.
- Create `hl7-toolkit/service/HL7Toolkit.Mwl.psm1`: strict request validation and C# adapter.
- Modify `hl7-toolkit/service/Start-HL7Toolkit.ps1`: import the MWL adapter without changing launcher behavior.
- Modify `hl7-toolkit/service/HL7Toolkit.Http.psm1`: add authenticated `POST /api/dicom/mwl/find` routing and safe error mapping.
- Create `hl7-toolkit/app/scripts/mwl-model.mjs`: local-date default, visible-criteria validation, request construction, bounded result/inspector projection, state clearing.
- Create `hl7-toolkit/app/scripts/mwl-ui.mjs`: MWL form, explicit run, layered results, table, inspector, warnings, and clear behavior.
- Modify `hl7-toolkit/app/scripts/dicom-core.mjs`: export provenance-controlled definitions for the approved MWL tags and sequences.
- Modify `hl7-toolkit/app/scripts/app.mjs`: mount the new controller.
- Modify `hl7-toolkit/app/index.html`: add the MWL area inside Diagnostics.
- Create `tests/hl7-toolkit/mwl-model.test.mjs`: pure request/result/privacy tests.
- Create `tests/hl7-toolkit/mwl-query.test.mjs`: protected route and controlled loopback protocol tests.
- Create `tests/hl7-toolkit/mwl-ui.test.mjs`: focused DOM workflow tests.
- Create `tests/hl7-toolkit/helpers/mwl-peer.mjs`: synthetic DICOM UL/DIMSE SCP scenarios only.
- Modify `tests/hl7-toolkit/ui-contract.test.mjs`: existing-navigation/additive contract.
- Modify `README-FIRST.md`, `hl7-toolkit/README.md`, and `hl7-toolkit/VERIFICATION.md`: checkpoint state and manual test instructions.

---

### Task 1: Pure MWL request model and provenance-controlled definitions

**Files:**
- Create: `tools/hl7-toolkit/hl7-toolkit/app/scripts/mwl-model.mjs`
- Modify: `tools/hl7-toolkit/hl7-toolkit/app/scripts/dicom-core.mjs`
- Create: `tools/hl7-toolkit/tests/hl7-toolkit/mwl-model.test.mjs`
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/dicom-core.test.mjs`

**Interfaces:**
- Consumes: `findDicomTag(query)` from `dicom-core.mjs`.
- Produces: `todayLocal(now: Date): string`, `buildMwlRequest(values: object): object`, `normalizeMwlResult(result: object): object`, `mwlInspectorRows(item: object): Array<{path,tag,keyword,value,definition}>`, and `emptyMwlState(): object`.
- Produces dictionary entries for every approved top-level and Scheduled Procedure Step Sequence tag. Definitions remain original Kairo descriptions with documented DICOM provenance.

- [ ] **Step 1: Write failing local-date and visible-criteria tests**

```js
test('new MWL query defaults visibly to the workstation local date', () => {
  assert.equal(todayLocal(new Date(2026, 8, 6, 23, 30)), '2026-09-06');
});

test('request requires one visible criterion and never broadens a single date', () => {
  assert.throws(() => buildMwlRequest(endpointValues({ scheduledDate: '' })), /MWL_CRITERION_REQUIRED/);
  const request = buildMwlRequest(endpointValues({ scheduledDate: '2026-09-06' }));
  assert.equal(request.criteria.scheduledDate, '20260906');
  assert.equal(request.criteria.scheduledDateRange, undefined);
});
```

- [ ] **Step 2: Run the model test and verify RED**

Run: `node --test tests/hl7-toolkit/mwl-model.test.mjs`

Expected: FAIL because `mwl-model.mjs` does not exist.

- [ ] **Step 3: Implement strict request construction**

Implement the exact request shape:

```js
{
  schema: 'kairo.mwl-query.v1',
  host, port, callingAe, calledAe, timeoutMs,
  criteria: {
    scheduledDate, scheduledDateRange,
    modality, scheduledStationAe, patientId, accessionNumber,
    requestedProcedureId, requestedProcedureDescription,
    procedureCode: { value, scheme },
    scheduledLocation
  }
}
```

Trim inputs; validate host, port 1–65535, timeout 100–10000 ms, AE titles 1–16 printable ASCII excluding backslash, DICOM DA values, paired range endpoints, paired procedure Code Value/Coding Scheme Designator, and bounded VR-compatible lengths. Omit empty criteria. Reject when the remaining criterion object is empty. Do not add wildcard characters or derived criteria.

- [ ] **Step 4: Add failing result-projection, clear-state, and dictionary tests**

```js
test('result projection caps items and clear state retains no patient values', () => {
  assert.throws(
    () => normalizeMwlResult({ classification: 'SUCCESS_MATCHES', items: syntheticItems(101) }),
    /MWL_RESPONSE_LIMIT_VIOLATION/
  );
  assert.deepEqual(emptyMwlState().items, []);
  assert.doesNotMatch(JSON.stringify(emptyMwlState()), /SYNTHETIC PATIENT/);
});

test('nested inspector paths use provenance-controlled definitions', () => {
  const row = mwlInspectorRows(syntheticItem()).find(item => item.keyword === 'ScheduledStationAETitle');
  assert.equal(row.path, 'Scheduled Procedure Step Sequence → Scheduled Station AE Title');
  assert.equal(row.tag, '(0040,0001)');
  assert.match(row.definition, /AE title/i);
});
```

- [ ] **Step 5: Implement the approved dictionary and safe projections**

Add definitions for Specific Character Set, Requested Procedure fields/sequences, Referenced Study Sequence, and all approved Scheduled Procedure Step attributes. `normalizeMwlResult` must accept only the documented structured response fields and reject responses with more than 100 items rather than silently truncating a server-boundary violation. `emptyMwlState` returns a fresh structure containing no prior values.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `node --test tests/hl7-toolkit/mwl-model.test.mjs tests/hl7-toolkit/dicom-core.test.mjs`

Expected: all tests pass with no warnings.

- [ ] **Step 7: Commit Task 1**

```bash
git add tools/hl7-toolkit/hl7-toolkit/app/scripts/mwl-model.mjs tools/hl7-toolkit/hl7-toolkit/app/scripts/dicom-core.mjs tools/hl7-toolkit/tests/hl7-toolkit/mwl-model.test.mjs tools/hl7-toolkit/tests/hl7-toolkit/dicom-core.test.mjs
git commit -m "Add bounded MWL request model"
```

### Task 2: Authenticated service validation boundary

**Files:**
- Create: `tools/hl7-toolkit/hl7-toolkit/service/HL7Toolkit.Mwl.psm1`
- Modify: `tools/hl7-toolkit/hl7-toolkit/service/Start-HL7Toolkit.ps1`
- Modify: `tools/hl7-toolkit/hl7-toolkit/service/HL7Toolkit.Http.psm1`
- Create: `tools/hl7-toolkit/tests/hl7-toolkit/mwl-query.test.mjs`

**Interfaces:**
- Consumes: `kairo.mwl-query.v1` request shape from Task 1.
- Produces: `Assert-KairoMwlQueryPayload -Payload`, `Invoke-KairoMwlQuery -Payload`, and authenticated `POST /api/dicom/mwl/find`.
- `Invoke-KairoMwlQuery` later calls `[Kairo.Diagnostics.MwlQueryClient]::Run($request)` and maps only fixed Kairo error codes.

- [ ] **Step 1: Write failing protected-route and no-network validation tests**

Extend `mwl-query.test.mjs` using the existing service harness and a connection-counting loopback listener:

```js
test('MWL route rejects unauthorized, non-POST, unconstrained, malformed AE and unpaired code criteria before connection', async () => {
  assert.equal((await unauthenticated('/api/dicom/mwl/find', validBody)).status, 403);
  for (const body of [unconstrained, badAe, codeWithoutScheme, invalidDateRange, unknownProperty]) {
    assert.equal((await service.request('/api/dicom/mwl/find', { method: 'POST', body })).status, 400);
  }
  assert.equal(connections, 0);
});
```

- [ ] **Step 2: Run the protected-route test and verify RED**

Run from Windows: `node --test tests/hl7-toolkit/mwl-query.test.mjs`

Expected: FAIL with route `404 NOT_FOUND`.

- [ ] **Step 3: Implement the minimum service boundary**

`Assert-KairoMwlQueryPayload` must reject arrays, unknown properties, request bodies over a fixed small limit, malformed host/port/timeout/AE/date/range/code inputs, empty criteria, wildcards not explicitly typed, and values exceeding the VR-specific limits. It must return a clean allowlisted object and never echo rejected values in errors.

Add only this route branch:

```powershell
if ($path -eq '/api/dicom/mwl/find') {
    if ($request.Method -ne 'POST') { throw 'MWL_METHOD_REJECTED' }
    $result = Invoke-KairoMwlQuery -Payload ($request.Body | ConvertFrom-Json)
}
```

Map known `MWL_*` codes to safe JSON errors. Import `HL7Toolkit.Mwl.psm1` in the existing helper startup. Until Task 3 adds the engine, a valid request returns `MWL_RUNTIME_UNAVAILABLE` without opening a connection.

- [ ] **Step 4: Rerun the route test and verify GREEN**

Run from Windows: `node --test tests/hl7-toolkit/mwl-query.test.mjs`

Expected: authentication/input cases pass; the valid-runtime placeholder case returns safe `503 MWL_RUNTIME_UNAVAILABLE`.

- [ ] **Step 5: Commit Task 2**

```bash
git add tools/hl7-toolkit/hl7-toolkit/service/HL7Toolkit.Mwl.psm1 tools/hl7-toolkit/hl7-toolkit/service/Start-HL7Toolkit.ps1 tools/hl7-toolkit/hl7-toolkit/service/HL7Toolkit.Http.psm1 tools/hl7-toolkit/tests/hl7-toolkit/mwl-query.test.mjs
git commit -m "Add protected MWL query boundary"
```

### Task 3: Isolated association and core C-FIND engine

**Files:**
- Create: `tools/hl7-toolkit/hl7-toolkit/service/DicomQueryDiagnostics.cs`
- Modify: `tools/hl7-toolkit/hl7-toolkit/service/HL7Toolkit.Mwl.psm1`
- Create: `tools/hl7-toolkit/tests/hl7-toolkit/helpers/mwl-peer.mjs`
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/mwl-query.test.mjs`

**Interfaces:**
- Produces C#: `Kairo.Diagnostics.MwlQueryRequest`, `MwlLayerResult`, `MwlItem`, `MwlQueryResult`, and `MwlQueryClient.Run(MwlQueryRequest request)`.
- The engine requests only MWL FIND SOP Class `1.2.840.10008.5.1.4.31` with Explicit VR Little Endian and Implicit VR Little Endian transfer syntaxes, uses one odd presentation-context ID, one C-FIND Message ID, and ordinary `TcpClient` networking.
- The synthetic peer accepts a scenario object and exposes `startMwlPeer(scenario)` returning `{host, port, requests, close()}`.

- [ ] **Step 1: Add failing zero-match, one-match, and layered-failure tests**

```js
test('terminal 0000 with no pending response is successful zero matches', async () => {
  const result = await queryScenario({ responses: [{ status: 0x0000 }] });
  assert.equal(result.classification, 'SUCCESS_ZERO_MATCHES');
  assert.equal(result.cfind.dicomStatus, '0x0000');
  assert.equal(result.matches.retained, 0);
});

test('one pending identifier followed by 0000 is a successful match', async () => {
  const result = await queryScenario({ responses: [{ status: 0xff00, item: syntheticItem() }, { status: 0x0000 }] });
  assert.equal(result.classification, 'SUCCESS_MATCHES');
  assert.equal(result.items.length, 1);
});

test('C-FIND failure preserves DNS TCP and association success', async () => {
  const result = await queryScenario({ responses: [{ status: 0xa900 }] });
  assert.equal(result.tcp.code, 'TCP_CONNECTED');
  assert.equal(result.association.code, 'ASSOCIATION_ACCEPTED');
  assert.equal(result.cfind.code, 'C_FIND_IDENTIFIER_REJECTED');
  assert.equal(result.matches.code, 'NOT_RUN');
});
```

- [ ] **Step 2: Run core protocol tests and verify RED**

Run from Windows: `node --test tests/hl7-toolkit/mwl-query.test.mjs`

Expected: FAIL because `DicomQueryDiagnostics.cs` and the synthetic MWL peer do not exist.

- [ ] **Step 3: Implement bounded UL association and request encoding**

Implement A-ASSOCIATE-RQ/AC/RJ/ABORT and P-DATA parsing without changing `EndpointDiagnostics.cs`. Validate protocol version, AE fields, application-context UID, presentation-context result, accepted transfer syntax, fixed/variable item lengths, PDU bounds, and read deadlines. Encode one C-FIND-RQ command with correlated Message ID and one identifier dataset containing approved matching and empty Return Keys, including one-item Scheduled Procedure Step Sequence.

- [ ] **Step 4: Implement response correlation and terminal classification**

Reassemble fragmented command/data PDVs. Require matching presentation context, Message ID Being Responded To, affected SOP Class, command field, dataset-type consistency, and bounded identifier dataset. Preserve actual unsigned status as `0xNNNN`. Only terminal `0x0000` plus zero pending identifiers yields `SUCCESS_ZERO_MATCHES`.

- [ ] **Step 5: Implement the controlled synthetic peer**

The Node helper must parse enough request framing to assert Called/Calling AE, requested MWL SOP Class, transfer syntaxes, C-FIND command, visible encoded criteria, and C-CANCEL correlation. It emits only synthetic identifiers and deterministic fragmented/combined response variants.

- [ ] **Step 6: Add failure/pending-warning/fragmentation tests**

Cover association RJ, denied MWL presentation context, abort, response timeout, malformed/oversized frames, wrong message/context/SOP/command, `0xFF01`, refusal, and fragmented command/dataset PDVs. Assert one connection and no retry.

- [ ] **Step 7: Run core protocol tests and verify GREEN**

Run from Windows: `node --test tests/hl7-toolkit/mwl-query.test.mjs`

Expected: all zero/one/warning/failure/fragmentation tests pass with no raw remote text in results or diagnostics.

- [ ] **Step 8: Commit Task 3**

```bash
git add tools/hl7-toolkit/hl7-toolkit/service/DicomQueryDiagnostics.cs tools/hl7-toolkit/hl7-toolkit/service/HL7Toolkit.Mwl.psm1 tools/hl7-toolkit/tests/hl7-toolkit/helpers/mwl-peer.mjs tools/hl7-toolkit/tests/hl7-toolkit/mwl-query.test.mjs
git commit -m "Add bounded MWL C-FIND engine"
```

### Task 4: Character sets, nested dataset projection, and PHI containment

**Files:**
- Modify: `tools/hl7-toolkit/hl7-toolkit/service/DicomQueryDiagnostics.cs`
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/mwl-query.test.mjs`

**Interfaces:**
- Extends each `MwlItem` with allowlisted top-level fields, one Scheduled Procedure Step projection, `specificCharacterSet`, `decodingWarnings`, and inspector-ready tag rows containing safe paths.
- Text decoder accepts only absent/`ISO_IR 6`, `ISO_IR 100`, and `ISO_IR 192`.

- [ ] **Step 1: Add failing charset and nested-sequence tests**

```js
for (const scenario of [defaultAscii, explicitAscii, latin1, utf8]) {
  test(scenario.name, async () => assert.equal((await queryScenario(scenario)).items[0].requestedProcedureDescription, scenario.expected));
}

test('unsupported charset keeps query success and withholds text bytes', async () => {
  const result = await queryScenario(unsupportedCharset);
  assert.match(result.classification, /^SUCCESS_/);
  assert.equal(result.items[0].patientName, 'CHARACTER_SET_NOT_SUPPORTED');
  assert.match(result.warnings[0].code, /CHARACTER_SET_NOT_SUPPORTED/);
  assert.doesNotMatch(JSON.stringify(result), /UNDECODED-PATIENT-CANARY|�/);
});
```

- [ ] **Step 2: Run charset tests and verify RED**

Run from Windows: `node --test --test-name-pattern="character|nested|unsupported|malformed" tests/hl7-toolkit/mwl-query.test.mjs`

Expected: FAIL because only core default-repertoire decoding exists.

- [ ] **Step 3: Implement deterministic bounded decoding**

Use strict decoder fallbacks that throw on malformed byte sequences. Map DICOM default/`ISO_IR 6` to strict ASCII, `ISO_IR 100` to ISO-8859-1, and `ISO_IR 192` to strict UTF-8. Unsupported charsets and malformed text set safe field markers and warnings naming only tag/keyword and charset—not value bytes.

Decode identifiers governed by default-repertoire VR rules independently after validating their bytes. Never use `Encoding.Default`, replacement fallback, console output, or exception messages containing decoded/undecoded values.

- [ ] **Step 4: Implement bounded allowlisted nested projection**

Parse only approved explicit/implicit VR elements and sequences within fixed PDU, dataset, item, element-count, nesting-depth, and value-length limits. Preserve the path `Scheduled Procedure Step Sequence → <attribute>`. Discard unknown values and all raw buffers after projection.

- [ ] **Step 5: Add disk/log/case leakage assertions**

Run an integration query with `SYNTHETIC-PATIENT-CANARY`, end the service, and recursively scan only its disposable data root plus captured stdout/stderr. Assert the canary does not occur. Assert MWL results are never posted to history/profile/baseline/case routes.

- [ ] **Step 6: Run charset/privacy tests and verify GREEN**

Run from Windows: `node --test tests/hl7-toolkit/mwl-query.test.mjs`

Expected: all protocol, charset, bounds, and leakage tests pass.

- [ ] **Step 7: Commit Task 4**

```bash
git add tools/hl7-toolkit/hl7-toolkit/service/DicomQueryDiagnostics.cs tools/hl7-toolkit/tests/hl7-toolkit/mwl-query.test.mjs
git commit -m "Decode bounded MWL results safely"
```

### Task 5: Fixed 100-match cap and C-CANCEL boundary

**Files:**
- Modify: `tools/hl7-toolkit/hl7-toolkit/service/DicomQueryDiagnostics.cs`
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/helpers/mwl-peer.mjs`
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/mwl-query.test.mjs`

**Interfaces:**
- `MwlQueryResult` exposes `matches.retained`, `matches.truncated`, `cancellation.code`, terminal/pending `dicomStatus` evidence, and at most 100 items.
- C-CANCEL uses command `0x0FFF` and Message ID Being Responded To equal to the active C-FIND Message ID.

- [ ] **Step 1: Add failing 99/100/101-match tests**

```js
test('99 matches complete normally', async () => {
  const result = await queryScenario(matchesThenSuccess(99));
  assert.equal(result.classification, 'SUCCESS_MATCHES');
  assert.equal(result.matches.truncated, false);
});

test('match 100 triggers correlated C-CANCEL and truncation', async () => {
  const { result, peer } = await queryScenario(matchesUntilCancel(101));
  assert.equal(result.items.length, 100);
  assert.equal(result.classification, 'SUCCESS_TRUNCATED');
  assert.equal(result.matches.truncated, true);
  assert.equal(result.cancellation.code, 'CANCEL_CONFIRMED');
  assert.equal(peer.requests.cancel.messageIdBeingRespondedTo, peer.requests.find.messageId);
});
```

- [ ] **Step 2: Run cap tests and verify RED**

Run from Windows: `node --test --test-name-pattern="99|100|101|cancel|truncat" tests/hl7-toolkit/mwl-query.test.mjs`

Expected: FAIL because the client does not yet send C-CANCEL at item 100.

- [ ] **Step 3: Implement immediate cap and bounded cancel read**

On retaining item 100, atomically set `truncated`, send one correlated C-CANCEL, reject all later identifiers from the retained projection, and wait only to the fixed cancellation deadline. Preserve the 100 items on every cancellation outcome. Never continue an unbounded read after cancel failure.

- [ ] **Step 4: Add race, exact-100, timeout, and send-failure tests**

Cover exact 100 plus remote `0x0000`, more-than-100 plus terminal `0xFE00`, final success racing the cancel write, cancel timeout, cancel send failure, and association close. Assert `SUCCESS_TRUNCATED`, retained 100, exact final status when received, and distinct `CANCEL_CONFIRMED`, `FINAL_RESPONSE_RACED_CANCEL`, `CANCEL_TIMEOUT`, `CANCEL_SEND_FAILED`, or `ASSOCIATION_CLOSED_AFTER_CANCEL`.

- [ ] **Step 5: Run cancellation tests and verify GREEN**

Run from Windows: `node --test tests/hl7-toolkit/mwl-query.test.mjs`

Expected: every cap/race/failure test passes; the peer observes one query, at most one cancel, and no retry.

- [ ] **Step 6: Commit Task 5**

```bash
git add tools/hl7-toolkit/hl7-toolkit/service/DicomQueryDiagnostics.cs tools/hl7-toolkit/tests/hl7-toolkit/helpers/mwl-peer.mjs tools/hl7-toolkit/tests/hl7-toolkit/mwl-query.test.mjs
git commit -m "Cap MWL results with C-CANCEL"
```

### Task 6: Existing Diagnostics UI, result table, and nested inspector

**Files:**
- Create: `tools/hl7-toolkit/hl7-toolkit/app/scripts/mwl-ui.mjs`
- Modify: `tools/hl7-toolkit/hl7-toolkit/app/scripts/app.mjs`
- Modify: `tools/hl7-toolkit/hl7-toolkit/app/index.html`
- Create: `tools/hl7-toolkit/tests/hl7-toolkit/mwl-ui.test.mjs`
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/ui-contract.test.mjs`

**Interfaces:**
- Consumes Task 1 `todayLocal`, `buildMwlRequest`, `normalizeMwlResult`, `mwlInspectorRows`, `emptyMwlState` and existing authenticated `api.request`.
- Produces `mountMwl(root, api, { now })` and a contained DICOM Modality Worklist section inside `data-workspace="diagnostics"`.

- [ ] **Step 1: Write failing form/no-auto-run tests**

```js
test('MWL form shows local date and sends nothing before explicit Run', () => {
  mountMwl(root, api, { now: () => new Date(2026, 8, 6, 10, 0) });
  assert.equal($('#mwl-scheduled-date').value, '2026-09-06');
  assert.equal(requests.length, 0);
});

test('clearing all visible criteria blocks locally', async () => {
  clearCriteria();
  await $('#mwl-run').listeners.click();
  assert.equal(requests.length, 0);
  assert.match($('#mwl-status').textContent, /at least one query criterion/i);
});
```

- [ ] **Step 2: Run UI tests and verify RED**

Run: `node --test tests/hl7-toolkit/mwl-ui.test.mjs`

Expected: FAIL because the MWL section/controller does not exist.

- [ ] **Step 3: Implement the explicit form and profile reuse**

Add host, port, Calling AE, Called AE, timeout, exact/range Scheduled Date controls, Modality, Station AE, Patient ID, Accession, Requested Procedure ID/Description, paired code/scheme, and Location. Reuse selected DICOM profile values through an explicit fill action or shared profile event; selection never runs a query. Show the exact date/range value that will be sent.

Disable duplicate Run while one request is active. Validation errors render as local `MWL_QUERY_NOT_SENT` outcomes with all network layers `NOT_RUN`.

- [ ] **Step 4: Add failing layer/table/inspector/clear tests**

```js
test('successful zero match is not rendered as a failure', async () => {
  api.respond(zeroMatchResult);
  await run();
  assert.match($('#mwl-summary').textContent, /SUCCESS_ZERO_MATCHES.*0/);
  assert.match($('#mwl-layer-cfind').textContent, /0x0000.*C_FIND_SUCCESS/);
});

test('truncation renders separate count and cancellation state', async () => {
  api.respond(truncated100Result);
  await run();
  assert.match($('#mwl-match-summary').textContent, /Matches retained: 100.*Query truncated: YES.*CANCEL_CONFIRMED/);
});

test('clear removes patient values from table and inspector', async () => {
  api.respond(onePatientResult);
  await run(); selectFirstRow(); clearResults();
  assert.doesNotMatch(root.visibleText(), /SYNTHETIC PATIENT|SYNTHETIC-ID/);
});
```

- [ ] **Step 5: Implement text-safe layered results and table**

Render DNS, TCP, Association, C-FIND, and Matches independently with `textContent`/created text nodes only. Display actual DICOM status beside classification. Keep Matches retained, Query truncated, and Cancellation separate. Explain zero matches and truncation as non-network failures. Render character-set warnings without patient text.

- [ ] **Step 6: Implement nested item inspector and clear disposal**

The table displays approved analyst columns including session-only Patient Name/ID. Selecting a row renders TAG, KEYWORD, VALUE, DEFINITION, and sequence path. **Clear MWL results** replaces the in-memory result state, table, inspector, summaries, and warnings with fresh empty values; it does not call the service or another Kairo workflow.

- [ ] **Step 7: Mount additively and verify UI GREEN**

Mount `mountMwl(document, api)` from `app.mjs`. Add the section inside Diagnostics; do not change existing navigation names or controllers.

Run: `node --test tests/hl7-toolkit/mwl-model.test.mjs tests/hl7-toolkit/mwl-ui.test.mjs tests/hl7-toolkit/diagnostics-ui.test.mjs tests/hl7-toolkit/dicom-core.test.mjs tests/hl7-toolkit/ui-contract.test.mjs tests/hl7-toolkit/case-ui.test.mjs`

Expected: all MWL and existing affected UI tests pass.

- [ ] **Step 8: Commit Task 6**

```bash
git add tools/hl7-toolkit/hl7-toolkit/app/scripts/mwl-ui.mjs tools/hl7-toolkit/hl7-toolkit/app/scripts/app.mjs tools/hl7-toolkit/hl7-toolkit/app/index.html tools/hl7-toolkit/tests/hl7-toolkit/mwl-ui.test.mjs tools/hl7-toolkit/tests/hl7-toolkit/ui-contract.test.mjs
git commit -m "Add MWL query result inspector"
```

### Task 7: Checkpoint verification, authoritative state, and Windows acceptance gate

**Files:**
- Modify: `tools/hl7-toolkit/README-FIRST.md`
- Modify: `tools/hl7-toolkit/hl7-toolkit/README.md`
- Modify: `tools/hl7-toolkit/hl7-toolkit/VERIFICATION.md`
- Modify: `tools/hl7-toolkit/docs/plans/2026-09-06-stage-seven-checkpoint-7-1-mwl-c-find.md`

**Interfaces:**
- Produces the user-testable Checkpoint 7.1 handoff and exact acceptance record. It does not start Checkpoint 7.2.

- [x] **Step 1: Run final focused browser checks**

```bash
node --check hl7-toolkit/app/scripts/mwl-model.mjs
node --check hl7-toolkit/app/scripts/mwl-ui.mjs
node --check hl7-toolkit/app/scripts/dicom-core.mjs
node --check hl7-toolkit/app/scripts/app.mjs
node --test tests/hl7-toolkit/mwl-model.test.mjs tests/hl7-toolkit/mwl-ui.test.mjs tests/hl7-toolkit/diagnostics-ui.test.mjs tests/hl7-toolkit/dicom-core.test.mjs tests/hl7-toolkit/ui-contract.test.mjs tests/hl7-toolkit/case-ui.test.mjs
```

Expected: syntax checks exit 0 and all focused browser tests pass.

- [x] **Step 2: Run final Windows service/protocol checks**

```powershell
node --test tests/hl7-toolkit/mwl-query.test.mjs tests/hl7-toolkit/endpoint-diagnostics.test.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/hl7-toolkit/helpers/service-probe.ps1
```

Expected: MWL protocol tests, unchanged TCP/C-ECHO regressions, and existing service probe pass under a standard-user token.

- [x] **Step 3: Run privacy and diff checks**

```bash
git diff --check
git status --short
```

Inspect the diff to confirm no raw fixture output, runtime data, profile, baseline, case, history, logs, binaries, dependency manifests, C-ECHO edits, or Checkpoint 7.2+ code entered the tree.

- [x] **Step 4: Update authoritative checkpoint documentation**

Record exact automated results, Windows availability limitations, supported character sets, 100-item cap, session-only PHI boundary, and manual steps. Mark Checkpoint 7.1 “ready for manual verification,” not complete.

- [x] **Step 5: Perform real Windows manual acceptance**

Using the existing launcher as a normal user and a controlled authorized MWL SCP:

1. Confirm Scheduled Date visibly defaults to today's local date and no query runs automatically.
2. Clear all criteria and confirm Run is blocked without traffic.
3. Enter/select one endpoint and run the visible default-date query explicitly.
4. Confirm DNS → TCP → Association → C-FIND → Matches render separately.
5. Run a successful zero-match query and confirm `SUCCESS_ZERO_MATCHES` with terminal `0x0000`.
6. Run a matching query and inspect the session-only table plus one nested Scheduled Procedure Step row in the tag inspector.
7. Confirm Patient Name/ID appear only when intentionally viewing the live returned result.
8. Clear results and confirm all returned values disappear.
9. Exercise the 100-item controlled scenario when available; confirm `SUCCESS_TRUNCATED`, Matches retained 100, Query truncated YES, and cancellation state.
10. Close/relaunch and confirm no MWL results return; confirm existing profiles, C-ECHO, and Stage 1–6 workspaces remain intact.

Accepted September 7, 2026 through the real Windows Kairo UI against the controlled synthetic MWL SCP. Verified the MWL form and explicit Run behavior; separate DNS, TCP, association, and C-FIND layers; one successful matching query; seven aligned result columns; the selected-row inspector; aligned TAG / KEYWORD / VALUE / DEFINITION fields; nested Scheduled Procedure Step paths; session-only patient-bearing result behavior; and Clear disposal. The bounded result/inspector alignment correction was manually retested and passed.

- [x] **Step 6: Stop for user acceptance**

Do not commit a completion claim, begin Checkpoint 7.2, or start Stage Eight until the user reports the real Windows checkpoint passed. After acceptance, update the record, commit/push the completed Checkpoint 7.1 tree, and stop.

## Acceptance traceability

| Spec criterion | Planned coverage |
|---|---|
| 1: Existing Diagnostics integration | Task 6 Steps 3 and 7; Task 7 Step 5 |
| 2–3: Visible local-date default permits query | Task 1 Steps 1–3; Task 6 Steps 1–3 |
| 4–5: Empty blocked; any approved visible criterion allowed | Task 1 Steps 1–3; Task 2 Steps 1–4; Task 6 Steps 1–3 |
| 6: No automatic query | Task 6 Steps 1–3 and 7 |
| 7: One endpoint/address/association/query | Task 3 Steps 3–7; Task 7 Step 5 |
| 8–9: Layer preservation and rejection boundaries | Task 3 Steps 1–7; Task 6 Steps 4–5 |
| 10: Actual DICOM status | Task 3 Steps 1 and 4; Task 6 Steps 4–5 |
| 11: Strict zero-match definition | Task 3 Steps 1 and 4; Task 6 Step 4 |
| 12: Normal matches | Task 3 Steps 1–7; Task 6 Steps 4–5 |
| 13–16: Cap, cancel, races, failure preservation | Task 5 Steps 1–5; Task 6 Steps 4–5 |
| 17: No retry/broadening/date expansion | Tasks 1–3; Task 6 Steps 1–3 |
| 18–20: Charset behavior | Task 4 Steps 1–6; Task 6 Step 5 |
| 21–22: Table and nested inspector | Task 1 Steps 4–6; Task 6 Steps 4–7 |
| 23: Clear/session disposal | Task 1 Steps 4–6; Task 6 Steps 4–7; Task 7 Step 5 |
| 24: PHI containment | Task 1 Steps 4–6; Task 4 Steps 1–6; Task 6 Steps 4–6; Task 7 Step 3 |
| 25: Bounded operation | Tasks 1–5; Task 7 Step 2 |
| 26: Stage 1–6 non-regression | Task 6 Step 7; Task 7 Steps 1–3 and 5 |
| 27: Real Windows acceptance | Task 7 Step 5 |
