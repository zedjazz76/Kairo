# Stage Seven Checkpoint 7.2 — MWL/ORM Workflow Comparison Implementation Plan

**Status — September 7, 2026:** Complete. Automated verification and final real Windows manual acceptance passed. The accepted implementation is committed together with its required global selector/navigation shell because both changes share UI integration files. Checkpoint 7.3 has not started.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task, sequentially and without subagents, parallel agents, or extra worktrees. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add an explicit, browser-session-only ORM-to-MWL comparison workflow that preserves source provenance and produces conservative “Why is this exam missing?” guidance.

**Architecture:** Add separate pure HL7 and MWL adapters, a pure comparison/guidance model, and a focused workflow UI controller. Extend the existing workbench and MWL controllers only with narrow read-only snapshots and invalidation notifications; do not redesign them or introduce shared global state, persistence, or service routes.

**Tech Stack:** Browser ES modules, existing Kairo HL7 parser and MWL projections, DOM `textContent`, Node.js `node:test`, minimal test DOM adapters.

**Spec:** `tools/hl7-toolkit/docs/specs/2026-09-07-stage-seven-checkpoint-7-2-mwl-orm-comparison.md`

## Global constraints

- Work only on Checkpoint 7.2. Do not start Query/Retrieve, Checkpoints 7.3–7.5, SR/GSPS, association capability inspection, or Stage Eight.
- Use strict RED → GREEN for each behavior. Run the named test and observe the expected feature-missing failure before production edits.
- Do not commit implementation or checkpoint documentation before real Windows manual acceptance. The working tree remains uncommitted at the manual gate.
- Do not automatically select an ORM, multi-order group, MWL row, accession source, patient, order, or likely match.
- Do not automatically recompute comparison after any source change.
- Group ORC/OBR structurally only. Never merge groups or infer ownership from identifier, procedure, patient, or date similarity.
- Successful zero-match mode uses the actual retained query context, never invents an item, and never emits item-level `MISSING_IN_MWL`.
- Preserve separate same-concept HL7 source rows and exact occurrence/component provenance. Define no universal source precedence or HL7 accession field.
- Display original values. Comparison may trim only approved surrounding/transport padding; no case folding, fuzzy matching, synonyms, vendor mapping, or timezone inference.
- Keep comparison and accession-source state in browser memory only. Add no service route, disk schema, browser storage, history event, profile, baseline, case, handoff, log, console, telemetry, or URL propagation.
- Render source values with `textContent` or created text nodes only. Never place PHI/accession values in DOM IDs or attributes.
- Guidance is deterministic and PHI-safe, normally names one qualified best-supported boundary, and provides one to three bounded next checks.

## File structure

- Create `hl7-toolkit/app/scripts/orm-workflow-adapter.mjs`: ORM eligibility, structural order groups, selected-group projection, populated accession choices.
- Create `hl7-toolkit/app/scripts/mwl-workflow-adapter.mjs`: selected-item and successful-zero-match projections.
- Create `hl7-toolkit/app/scripts/workflow-comparison-model.mjs`: registry-driven rows, normalization, aggregation, and fixed-template guidance.
- Create `hl7-toolkit/app/scripts/workflow-comparison-ui.mjs`: explicit selection state machine, source-token validation, safe rendering, invalidation, and Clear.
- Modify `hl7-toolkit/app/scripts/workbench.mjs`: narrow selected-message snapshot and invalidation contract.
- Modify `hl7-toolkit/app/scripts/mwl-ui.mjs`: retain the submitted query with the result and expose narrow result/selected-row snapshots plus invalidation.
- Modify `hl7-toolkit/app/scripts/app.mjs`: mount the comparison controller with the two source interfaces.
- Modify `hl7-toolkit/app/index.html`: add the DICOM Workflow comparison area and six-column table.
- Modify `hl7-toolkit/app/styles/app.css`: scoped wrapping/state/accessibility styles only.
- Create `tests/hl7-toolkit/orm-workflow-adapter.test.mjs`.
- Create `tests/hl7-toolkit/mwl-workflow-adapter.test.mjs`.
- Create `tests/hl7-toolkit/workflow-comparison-model.test.mjs`.
- Create `tests/hl7-toolkit/workflow-comparison-ui.test.mjs`.
- Modify `tests/hl7-toolkit/mwl-ui.test.mjs`, `tests/hl7-toolkit/ui-contract.test.mjs`, and affected workbench tests.
- Modify `README-FIRST.md`, `hl7-toolkit/README.md`, `hl7-toolkit/VERIFICATION.md`, and this plan only at the final manual-verification gate.

---

### Task 1: Pure ORM eligibility and structural order-group adapter

**Files:**
- Create: `tools/hl7-toolkit/hl7-toolkit/app/scripts/orm-workflow-adapter.mjs`
- Create: `tools/hl7-toolkit/tests/hl7-toolkit/orm-workflow-adapter.test.mjs`

**Interfaces:**
- Consumes: parsed message returned by `parseHl7(source)`.
- Produces: `inspectOrmMessage(message): { eligibility, msh9, groups, ambiguity }`.
- Produces: `projectOrmGroup(inspection, groupId): { groupId, msh9, segmentOccurrences, values, accessionChoices }`.
- Each `values` entry is `{ concept, role, path, value, datatype, components }`; `components` preserves all populated repetition/component/subcomponent paths and values.

- [x] **Step 1: Add failing ORM eligibility tests**

Cover ORM+OBR, ORM+ORC, ORM+ORC+OBR, non-ORM+OBR, ORM without ORC/OBR, malformed MSH-9, and exact MSH-9 preservation:

```js
const eligible = inspectOrmMessage(parseHl7('MSH|^~\\&|A|F|B|F|202609071000||ORM^O01|1|P|2.5.1\rORC|NW\rOBR|1|P1|F1|PROC^MRI BRAIN^LOCAL'));
assert.equal(eligible.eligibility, 'ELIGIBLE');
assert.equal(eligible.msh9, 'ORM^O01');
assert.equal(inspectOrmMessage(parseHl7(nonOrmWithObr)).eligibility, 'ORM_REQUIRED');
assert.equal(inspectOrmMessage(parseHl7(ormWithoutOrder)).eligibility, 'ORM_REQUIRED');
```

- [x] **Step 2: Run the eligibility tests and verify RED**

Run: `node --test tests/hl7-toolkit/orm-workflow-adapter.test.mjs`

Expected: FAIL because `orm-workflow-adapter.mjs` does not exist.

- [x] **Step 3: Implement minimum ORM eligibility**

Use `getValue(message, 'MSH-9')`, require message type component `ORM`, require at least one ORC/OBR, preserve exact MSH-9, and return fixed safe states. Do not inspect filenames, catalog labels, or identifier values.

- [x] **Step 4: Run eligibility tests and verify GREEN**

Run: `node --test tests/hl7-toolkit/orm-workflow-adapter.test.mjs`

Expected: all eligibility tests pass.

- [x] **Step 5: Add failing structural group/provenance tests**

Cover one ORC/OBR group, ORC-only, OBR-only, two groups requiring selection, selection of each group, no cross-group merge, occurrence paths, populated accession choices, and an explicitly ambiguous structure fixture:

```js
const inspection = inspectOrmMessage(parseHl7(twoGroupOrm));
assert.equal(inspection.groups.length, 2);
assert.equal(inspection.selectionState, 'ORDER_GROUP_SELECTION_REQUIRED');
assert.deepEqual(projectOrmGroup(inspection, inspection.groups[1].id).values.filter(v => v.role === 'PLACER').map(v => v.path), ['ORC[2]-2', 'OBR[2]-2']);
assert.doesNotMatch(JSON.stringify(projectOrmGroup(inspection, inspection.groups[1].id)), /GROUP-ONE/);
assert.equal(inspectOrmMessage(parseHl7(ambiguousOrm)).ambiguity, 'ORDER_GROUP_AMBIGUOUS');
```

- [x] **Step 6: Run group tests and verify RED**

Run: `node --test tests/hl7-toolkit/orm-workflow-adapter.test.mjs`

Expected: FAIL because grouping/projection is not implemented.

- [x] **Step 7: Implement structural grouping and group-local extraction**

Walk parsed segments in order. Start a group on ORC; attach structurally following OBR segments until the next ORC. Create an OBR-only group when no ORC owns it. Mark a structure ambiguous when the sequence cannot produce one deterministic ownership under these rules. Extract only group-local ORC-1/2/3 and OBR-2/3/4 plus registry-supported provenance; include message-associated PID-3 separately as identity evidence. Enumerate every populated group field/component as an accession choice without assigning accession meaning.

- [x] **Step 8: Run adapter tests and verify GREEN**

Run: `node --test tests/hl7-toolkit/orm-workflow-adapter.test.mjs tests/hl7-toolkit/parser.test.mjs`

Expected: ORM adapter and existing parser tests pass.

Do not commit; continue sequentially.

---

### Task 2: MWL comparison adapter and narrow source snapshots

**Files:**
- Create: `tools/hl7-toolkit/hl7-toolkit/app/scripts/mwl-workflow-adapter.mjs`
- Create: `tools/hl7-toolkit/tests/hl7-toolkit/mwl-workflow-adapter.test.mjs`
- Modify: `tools/hl7-toolkit/hl7-toolkit/app/scripts/mwl-ui.mjs`
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/mwl-ui.test.mjs`

**Interfaces:**
- Consumes: `{ generation, request, result, selectedIndex }` snapshot from MWL controller.
- Produces: `projectMwlTarget(snapshot): { state, mode, generation, query, item }`.
- MWL controller returns `{ getComparisonSnapshot(), onComparisonSourceChange(listener) }` from `mountMwl`.
- `getComparisonSnapshot()` returns a fresh clone and never exposes mutable controller state.

- [x] **Step 1: Add failing pure MWL adapter tests**

Cover multiple matches without selection, selected item, selected nested paths, successful zero-match query criteria/layers/status/count, and rejection of failed/truncated/incomplete/cleared contexts:

```js
assert.equal(projectMwlTarget(matchSnapshot({ selectedIndex: -1 })).state, 'MWL_ITEM_SELECTION_REQUIRED');
const selected = projectMwlTarget(matchSnapshot({ selectedIndex: 1 }));
assert.equal(selected.mode, 'SELECTED_ITEM_COMPARISON');
assert.equal(selected.item.patientId, 'ID-2');
const zero = projectMwlTarget(zeroSnapshot());
assert.equal(zero.mode, 'ZERO_MATCH_QUERY_CONTEXT');
assert.equal(zero.query.result.cfind.dicomStatus, '0x0000');
assert.equal(zero.item, null);
```

- [x] **Step 2: Run pure MWL adapter tests and verify RED**

Run: `node --test tests/hl7-toolkit/mwl-workflow-adapter.test.mjs`

Expected: FAIL because the adapter does not exist.

- [x] **Step 3: Implement minimum two-mode MWL projection**

Accept selected-item mode only for a current in-range selected index. Accept zero-match mode only for `SUCCESS_ZERO_MATCHES`, terminal successful C-FIND evidence, and zero retained items. Return fixed local states for unavailable, stale, failed, incomplete, truncated, or item-selection-required sources. Copy only existing allowlisted values, tag paths, submitted request criteria, safe endpoint fields, protocol layer codes/status, and counts.

- [x] **Step 4: Run pure MWL adapter tests and verify GREEN**

Run: `node --test tests/hl7-toolkit/mwl-workflow-adapter.test.mjs`

Expected: all MWL adapter tests pass.

- [x] **Step 5: Add failing MWL controller snapshot/invalidation tests**

Verify submitted criteria are retained with the completed result; no snapshot exists before a query; row selection updates only selected index/generation; new result and Clear invalidate selection; snapshots are clones; and no extra API call occurs:

```js
const controller = mountMwl(root, api);
assert.equal(controller.getComparisonSnapshot(), null);
await root.querySelector('#mwl-run').listeners.click();
const first = controller.getComparisonSnapshot();
assert.equal(first.request.criteria.accessionNumber, 'SYNTH-ACC');
root.querySelector('#mwl-results').children[0].listeners.click();
assert.equal(controller.getComparisonSnapshot().selectedIndex, 0);
root.querySelector('#mwl-clear').listeners.click();
assert.equal(controller.getComparisonSnapshot(), null);
assert.equal(requests.length, 1);
```

- [x] **Step 6: Run MWL UI tests and verify RED**

Run: `node --test tests/hl7-toolkit/mwl-ui.test.mjs`

Expected: FAIL because `mountMwl` exposes no comparison snapshot contract.

- [x] **Step 7: Implement the narrow MWL source contract**

Retain the exact validated submitted request beside its returned result. Increment an opaque generation on completed replacement, selection change, and Clear. Notify registered listeners only to invalidate comparison state. Return fresh structured clones. Preserve every Checkpoint 7.1 render/query behavior and do not make any new request.

- [x] **Step 8: Run MWL adapter/UI regression tests and verify GREEN**

Run: `node --test tests/hl7-toolkit/mwl-workflow-adapter.test.mjs tests/hl7-toolkit/mwl-ui.test.mjs tests/hl7-toolkit/mwl-model.test.mjs`

Expected: all tests pass; existing MWL request/render/Clear behavior remains unchanged.

Do not commit; continue sequentially.

---

### Task 3: Pure provenance-preserving comparison model

**Files:**
- Create: `tools/hl7-toolkit/hl7-toolkit/app/scripts/workflow-comparison-model.mjs`
- Create: `tools/hl7-toolkit/tests/hl7-toolkit/workflow-comparison-model.test.mjs`

**Interfaces:**
- Produces: `compareOrmToMwl({ orm, mwl, accessionSourcePath }): ComparisonResult`.
- Produces: `clearWorkflowComparisonState(): { ormSource, groupId, accessionSourcePath, mwlTarget, comparison }`.
- `ComparisonResult` is `{ mode, rows, concepts, guidance, warnings }`.
- Row is `{ id, concept, role, valueKind, hl7Source, hl7Value, mwlSource, mwlValue, state, precision, explanation }`.

- [x] **Step 1: Add failing row/state and multi-source tests**

Cover separate ORC-2/OBR-2 and ORC-3/OBR-3 rows, agreement, conflict, explicit registry counterpart requirements, every row state, concept aggregation, and original-input nonmutation:

```js
const result = compareOrmToMwl(equalPlacerFixture);
assert.deepEqual(result.rows.filter(r => r.role === 'PLACER').map(r => r.hl7Source), ['ORC[1]-2', 'OBR[1]-2']);
assert.equal(result.concepts.find(c => c.concept === 'ORDER').state, 'CONSISTENT');
const conflict = compareOrmToMwl(conflictingPlacerFixture);
assert.equal(conflict.concepts.find(c => c.concept === 'ORDER').state, 'AMBIGUOUS');
assert.equal(conflict.rows.filter(r => r.role === 'PLACER').length, 2);
```

- [x] **Step 2: Run model tests and verify RED**

Run: `node --test tests/hl7-toolkit/workflow-comparison-model.test.mjs`

Expected: FAIL because the comparison model does not exist.

- [x] **Step 3: Implement registry-driven rows and aggregation**

Define the approved concepts and explicit pairings. Emit separate rows for every HL7 source. Emit missing states only for registry-established active counterparts; otherwise emit `NOT_COMPARABLE` or concept-level `PARTIALLY_AVAILABLE`. In zero-match mode compare only established ORM/query-criterion pairs and never create item-level missing rows. Aggregate by row IDs without deleting or replacing evidence.

- [x] **Step 4: Run row/state tests and verify GREEN**

Run: `node --test tests/hl7-toolkit/workflow-comparison-model.test.mjs`

Expected: row, state, aggregation, and zero-match invariants pass.

- [x] **Step 5: Add failing accession, composite, code, text, and date/time tests**

Cover Not established, one selected path, other accession-like fields excluded, lifecycle reset shape, whitespace explanation, case-sensitive identifiers/AE/location/text, full composite PID-3 authority/namespace/type, code+system equality/difference/missing system, description isolation, compatible minute/second precision, incompatible precision, ambiguous timestamps, and unchanged originals.

```js
assert.equal(compareOrmToMwl({ ...fixture, accessionSourcePath: '' }).rows.find(r => r.concept === 'ACCESSION').state, 'NOT_COMPARABLE');
assert.equal(compareOrmToMwl(codeFixture('12345', 'LOCAL', '12345', 'LOINC')).rows.find(r => r.role === 'PROCEDURE_CODE').state, 'MISMATCH');
assert.equal(compareOrmToMwl(dateOnlyVsTimestamp).rows.find(r => r.concept === 'SCHEDULE').state, 'NOT_COMPARABLE');
assert.equal(compositeAuthorityDifference.rows.find(r => r.concept === 'IDENTITY').state === 'MATCH', false);
```

- [x] **Step 6: Run normalization tests and verify RED**

Run: `node --test tests/hl7-toolkit/workflow-comparison-model.test.mjs`

Expected: FAIL on unimplemented concept-specific comparators.

- [x] **Step 7: Implement conservative concept comparators**

Keep originals in rows. Internally trim only surrounding/transport padding. Compare composites component-by-component, code plus system, exact case-sensitive text/AE/location, and date/time only at compatible explicit precision. Never infer timezone, accession, synonyms, vendor equivalence, or description-to-code equivalence. Explain any trimming.

- [x] **Step 8: Run complete pure model tests and verify GREEN**

Run: `node --test tests/hl7-toolkit/workflow-comparison-model.test.mjs tests/hl7-toolkit/orm-workflow-adapter.test.mjs tests/hl7-toolkit/mwl-workflow-adapter.test.mjs`

Expected: all adapter and model tests pass with no mutation or PHI output in safe fields.

Do not commit; continue sequentially.

---

### Task 4: Deterministic PHI-safe “Why is this exam missing?” guidance

**Files:**
- Modify: `tools/hl7-toolkit/hl7-toolkit/app/scripts/workflow-comparison-model.mjs`
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/workflow-comparison-model.test.mjs`

**Interfaces:**
- Produces: `buildWorkflowGuidance({ mode, rows, concepts, orm, mwl }): { observed, likelyBoundary, missingEvidence, nextChecks }`.
- `nextChecks` contains one to three fixed-template actions.

- [x] **Step 1: Add failing guidance-priority tests**

Cover successful zero match, modality mismatch, established location mismatch, location-versus-AE non-comparability, cancellation lifecycle tension, source conflict, code/system mismatch, and predominantly consistent evidence. Assert one best-supported boundary unless an exact tie rule applies.

- [x] **Step 2: Add failing PHI/certainty/next-check bound tests**

Use patient/accession/free-text canaries in source rows and assert they never appear in guidance JSON, errors, or warnings. Assert `nextChecks.length` is 1–3 and templates never contain `root cause`, `proved`, or `proves`.

```js
const guidance = buildWorkflowGuidance(phiCanaryFixture);
assert.doesNotMatch(JSON.stringify(guidance), /SYNTHETIC-PATIENT-CANARY|SYNTH-ACCESSION-CANARY/);
assert.ok(guidance.nextChecks.length >= 1 && guidance.nextChecks.length <= 3);
assert.doesNotMatch(JSON.stringify(guidance), /root cause|proved|proves/i);
```

- [x] **Step 3: Run guidance tests and verify RED**

Run: `node --test --test-name-pattern="guidance|zero match|lifecycle|boundary|canary" tests/hl7-toolkit/workflow-comparison-model.test.mjs`

Expected: FAIL because fixed-template guidance selection is absent.

- [x] **Step 4: Implement minimum ordered guidance rules**

Apply the approved precedence: source/structure → protocol completeness → successful zero match → lifecycle tension → established mismatch → source conflict → established missing → partial/non-comparable → consistency. Build strings only from fixed templates, safe concept labels, provenance paths, states, protocol codes, and counts. Never interpolate raw source values.

- [x] **Step 5: Run complete model suite and verify GREEN**

Run: `node --test tests/hl7-toolkit/workflow-comparison-model.test.mjs`

Expected: all comparison and guidance tests pass; guidance remains qualified and PHI-safe.

Do not commit; continue sequentially.

---

### Task 5: Explicit source contracts and workflow comparison UI

**Files:**
- Create: `tools/hl7-toolkit/hl7-toolkit/app/scripts/workflow-comparison-ui.mjs`
- Create: `tools/hl7-toolkit/tests/hl7-toolkit/workflow-comparison-ui.test.mjs`
- Modify: `tools/hl7-toolkit/hl7-toolkit/app/scripts/workbench.mjs`
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/ui-contract.test.mjs`
- Modify: `tools/hl7-toolkit/hl7-toolkit/app/scripts/app.mjs`
- Modify: `tools/hl7-toolkit/hl7-toolkit/app/index.html`
- Modify: `tools/hl7-toolkit/hl7-toolkit/app/styles/app.css`
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/ui-contract.test.mjs`

**Interfaces:**
- Workbench controller adds `getSelectedMessageSnapshot(): { generation, id, index, type, text } | null` and `onSelectedMessageChange(listener)`.
- `mountWorkflowComparison(root, { hl7Source, mwlSource })` returns `{ clear(), getState() }` for tests only; returned state is cloned.
- Controller state is `{ ormSnapshot, ormInspection, groupId, accessionSourcePath, mwlProjection, comparison, sourceTokens }`.

- [x] **Step 1: Add failing workbench read-only snapshot/invalidation tests**

Verify no snapshot before selection, fresh cloned snapshot after selection, generation changes on selected message switch/edit/undo/redo, and notifications carry no raw values. Existing selection/render/edit behavior must remain unchanged.

- [x] **Step 2: Run affected workbench tests and verify RED**

Run: `node --test tests/hl7-toolkit/ui-contract.test.mjs tests/hl7-toolkit/editor.test.mjs tests/hl7-toolkit/parser.test.mjs`

Expected: FAIL on the absent selected-message source contract.

- [x] **Step 3: Implement the minimum workbench source contract**

Maintain an opaque counter; return a new object containing only the selected catalog identity and text needed for local parsing. Notify invalidation listeners on selected-source change without logging or exposing values. Do not automatically select a comparison source.

- [x] **Step 4: Run affected workbench tests and verify GREEN**

Run: `node --test tests/hl7-toolkit/ui-contract.test.mjs tests/hl7-toolkit/editor.test.mjs tests/hl7-toolkit/parser.test.mjs`

Expected: tests pass and existing workbench behavior is unchanged.

- [x] **Step 5: Add failing UI state-machine tests**

Cover explicit **Use selected HL7 ORM**, `ORM_REQUIRED`, one-group activation, multi-group explicit selection, ambiguous grouping, Not established accession, explicit populated accession path, explicit selected MWL item, successful zero-match target, explicit Compare only, all local blocking states, and six-column row rendering.

- [x] **Step 6: Add failing invalidation/Clear/text-safety/privacy tests**

Verify ORM change clears group/accession/result, group change clears accession/result, MWL row change clears result, replaced/cleared MWL source becomes `NO_MWL_TARGET`, stale tokens block as `SOURCE_STALE`/`COMPARISON_INVALIDATED`, and no invalidation runs Compare. Verify **Clear comparison** retains selected ORM/group but clears accession, target, rows, summaries, and guidance. Inject HTML/PHI canaries and assert literal cell text, no child HTML nodes, no API/storage calls, and PHI-free guidance/status/errors.

- [x] **Step 7: Run UI tests and verify RED**

Run: `node --test tests/hl7-toolkit/workflow-comparison-ui.test.mjs tests/hl7-toolkit/ui-contract.test.mjs`

Expected: FAIL because the workflow UI/controller and markup do not exist.

- [x] **Step 8: Implement the minimum UI controller and markup**

Add one card inside Diagnostics/DICOM Workflow with:

- **Use selected HL7 ORM** action and selected MSH-9/source summary;
- conditional order-group selector;
- visible accession-source selector defaulted to Not established;
- **Use current MWL target** action and selected-item/zero-match label;
- explicit **Compare ORM to MWL** and **Clear comparison** actions;
- six-column CONCEPT / HL7 SOURCE / HL7 VALUE / MWL SOURCE / MWL VALUE / RESULT table;
- concept summaries and four fixed guidance regions.

Render with created nodes/`textContent`. Use classes, not PHI-bearing attributes, for states. Subscribe only to invalidation notifications. Re-read source tokens on Compare; never run automatically.

- [x] **Step 9: Wire narrow controllers in `app.mjs`**

Capture the returned MWL controller and pass the existing workbench plus MWL read-only interfaces to `mountWorkflowComparison`. Do not add API dependencies or global state.

- [x] **Step 10: Add scoped layout/accessibility styles**

Use existing card/table tokens. Ensure long values wrap (`overflow-wrap: anywhere`), result states are text labels and not color-only, tables remain aligned, and narrow layouts scroll/wrap without changing accepted MWL table styles.

- [x] **Step 11: Run UI and affected browser suites and verify GREEN**

Run:

```bash
node --test tests/hl7-toolkit/workflow-comparison-ui.test.mjs tests/hl7-toolkit/workflow-comparison-model.test.mjs tests/hl7-toolkit/orm-workflow-adapter.test.mjs tests/hl7-toolkit/mwl-workflow-adapter.test.mjs tests/hl7-toolkit/mwl-ui.test.mjs tests/hl7-toolkit/mwl-model.test.mjs tests/hl7-toolkit/diagnostics-ui.test.mjs tests/hl7-toolkit/ui-contract.test.mjs tests/hl7-toolkit/parser.test.mjs tests/hl7-toolkit/editor.test.mjs tests/hl7-toolkit/case-ui.test.mjs
```

Expected: all Checkpoint 7.2 and affected Stage 1–7.1 browser tests pass.

Do not commit; continue to the verification gate.

---

### Task 6: Final automated verification, authoritative handoff, and manual gate

**Files:**
- Modify: `tools/hl7-toolkit/README-FIRST.md`
- Modify: `tools/hl7-toolkit/hl7-toolkit/README.md`
- Modify: `tools/hl7-toolkit/hl7-toolkit/VERIFICATION.md`
- Modify: `tools/hl7-toolkit/docs/plans/2026-09-07-stage-seven-checkpoint-7-2-mwl-orm-comparison.md`

**Interfaces:**
- Produces the exact uncommitted Checkpoint 7.2 manual-acceptance handoff. It does not claim completion or start Checkpoint 7.3.

- [x] **Step 1: Run JavaScript syntax checks**

```bash
node --check hl7-toolkit/app/scripts/orm-workflow-adapter.mjs
node --check hl7-toolkit/app/scripts/mwl-workflow-adapter.mjs
node --check hl7-toolkit/app/scripts/workflow-comparison-model.mjs
node --check hl7-toolkit/app/scripts/workflow-comparison-ui.mjs
node --check hl7-toolkit/app/scripts/workbench.mjs
node --check hl7-toolkit/app/scripts/mwl-ui.mjs
node --check hl7-toolkit/app/scripts/app.mjs
```

Expected: every syntax check exits 0.

- [x] **Step 2: Run final affected browser suite**

Run the exact Task 5 Step 11 command.

Expected: every Checkpoint 7.2 and affected Stage 1–7.1 browser test passes.

- [x] **Step 3: Run unchanged Windows service/protocol regression gates**

From `tools/hl7-toolkit`:

```powershell
node --test tests/hl7-toolkit/mwl-query.test.mjs tests/hl7-toolkit/endpoint-diagnostics.test.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/hl7-toolkit/helpers/service-probe.ps1
```

Expected: existing Checkpoint 7.1 MWL protocol, endpoint diagnostics, and service probe pass. Checkpoint 7.2 creates no service route.

- [x] **Step 4: Run privacy/scope/diff checks**

```bash
git diff --check
git status --short
git diff --stat
```

Inspect the complete diff, including new files, and confirm no runtime data, raw fixture output, PHI canary, browser storage, service route, persistence schema, dependency, Checkpoint 7.3+ code, or unrelated refactor entered the tree.

- [x] **Step 5: Update authoritative checkpoint documentation**

Record exact tests actually run, supported selected-item/zero-match modes, explicit selection/invalidation behavior, conservative comparison limits, session-only accession mapping, PHI-safe guidance, and manual steps. Mark Checkpoint 7.2 **ready for real Windows manual verification, not complete**.

- [x] **Step 6: Stop for real Windows manual acceptance**

Using synthetic data only through the existing Windows launcher as a normal user:

1. Load multiple HL7 messages including one non-ORM and at least one eligible ORM. Confirm no ORM is chosen automatically; explicitly select/use the ORM; verify non-ORM yields `ORM_REQUIRED`.
2. Exercise a one-group ORM, then a multi-group ORM. Confirm the sole group activates only after explicit ORM selection, multiple groups require explicit choice, and switching groups changes occurrence provenance without merging values.
3. Confirm HL7 Accession Source defaults to Not established and ACCESSION is `NOT_COMPARABLE`. Select one populated group path and verify only that path becomes accession evidence.
4. Run a synthetic MWL query returning multiple items. Confirm no row is selected automatically; explicitly select one row and choose it as the target.
5. Select **Compare ORM to MWL**. Confirm nothing compared before the click; afterward verify six aligned columns, original values, exact ORC/OBR and nested DICOM provenance, separate same-concept rows, concept summaries, and qualified four-part guidance.
6. Exercise matching and conflicting placer/filler evidence, code-system mismatch, composite identifier authority difference, case-sensitive modality/location/AE evidence, and date/time precision. Confirm conservative states without fuzzy equivalence.
7. Run a successful synthetic zero-match query. Use its query context and verify endpoint, visible criteria, DNS/TCP/association/C-FIND, actual `0x0000`, zero count, and `SUCCESS_ZERO_MATCHES`; confirm no synthetic item and no item-level `MISSING_IN_MWL`.
8. Change the selected ORM/group/MWL row and replace or Clear MWL results. Confirm prior output invalidates, vanished rows become `NO_MWL_TARGET`, accession resets where required, and comparison never reruns automatically.
9. Choose **Clear comparison**. Confirm accession choice, MWL target, rows, summaries, and guidance clear while the selected ORM/group and underlying HL7/MWL evidence remain available.
10. Confirm long values wrap, remote-looking markup renders literally, state is readable without color, guidance contains no patient/accession values, and no comparison appears in case, profile, baseline, history, handoff, logs, console, URL, or after reload.

Do not commit. Report the uncommitted tree as ready for manual verification and stop. After the user reports acceptance, update the record, run only the defined final verification plus `git diff --check`, commit/push Checkpoint 7.2, and stop. Do not begin Checkpoint 7.3.
