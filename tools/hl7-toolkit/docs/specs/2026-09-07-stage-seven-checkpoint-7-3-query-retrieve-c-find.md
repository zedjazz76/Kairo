# Stage Seven Checkpoint 7.3 — Read-Only Study Root Query/Retrieve C-FIND

**Status:** Proposed for user approval on September 7, 2026

**Parent:** `2026-09-06-stage-seven-dicom-workflow-diagnostics.md`

**Precondition:** Checkpoints 7.1 and 7.2 and the global selector/navigation shell are complete, manually accepted, committed, and pushed at `d97ba5b133360c1a6e1bfdf26ab06361d8ee0ce7`.

## 1. Objective

Add one analyst-directed, read-only PACS study query that helps answer: **“Is this study actually present in PACS?”** The analyst explicitly targets one authorized endpoint, supplies at least one visible narrowing criterion, runs one Study Root C-FIND, and inspects bounded session-only study results with layered protocol evidence.

Checkpoint 7.3 is query only. It never retrieves, stores, changes, deletes, commits, discovers, scans, or automatically probes anything.

## 2. Scope

Checkpoint 7.3 includes:

- Study Root Query/Retrieve Information Model — FIND;
- `QueryRetrieveLevel (0008,0052) = STUDY`;
- one explicit endpoint and one explicit Run action;
- visible study-level matching criteria;
- approved empty return keys;
- DNS → TCP → DICOM association → C-FIND → matches evidence;
- actual DICOM status values and conservative Kairo classifications;
- at most 100 retained results with correlated C-CANCEL;
- a session-only study table and selected-row tag inspector;
- the approved Checkpoint 7.1 character-set boundary; and
- one new card/tool view in the existing Diagnostics selector.

## 3. Exclusions

Checkpoint 7.3 does not implement:

- Patient Root Query/Retrieve;
- series-level or image/instance-level query;
- C-MOVE, C-GET, C-STORE, Storage Commitment, retrieval, download, export, delete, or modification;
- wildcard-all query generation, hidden criteria, filter relaxation, automatic broadening, automatic retry, background query, polling, endpoint discovery, AE discovery, or scanning;
- automatic correlation with ORM, MWL, cases, evidence summaries, baselines, handoffs, or history;
- persistence of request criteria, query results, selected rows, raw datasets, or PHI;
- redesign of C-ECHO, MWL C-FIND, Checkpoint 7.2 comparison, endpoint profiles, cases, or the navigation shell; or
- Checkpoints 7.4/7.5 or Stage 8.

## 4. Standards Basis

The sole abstract syntax is **Study Root Query/Retrieve Information Model — FIND**, UID `1.2.840.10008.5.1.4.1.2.2.1`. The identifier always contains `QueryRetrieveLevel (0008,0052)` with the exact value `STUDY`. Study-level keys follow the Study Root model in DICOM PS3.4 Table C.6-5. C-FIND command/status behavior follows PS3.7, association and P-DATA behavior follows PS3.8, and text encoding follows PS3.5.

Authoritative references:

- DICOM PS3.4 Study Root SOP Class Group: https://dicom.nema.org/medical/dicom/current/output/chtml/part04/sect_C.6.2.html
- DICOM PS3.4 Study Root FIND SOP Class UID: https://dicom.nema.org/medical/dicom/current/output/chtml/part04/sect_C.6.2.3.html
- DICOM PS3.4 C-FIND behavior: https://dicom.nema.org/medical/dicom/current/output/chtml/part04/sect_C.4.1.html
- DICOM PS3.7 DIMSE-C: https://dicom.nema.org/medical/dicom/current/output/chtml/part07/chapter_9.html
- DICOM PS3.8 association/P-DATA: https://dicom.nema.org/medical/dicom/current/output/chtml/part08/sect_9.3.html
- DICOM PS3.5 encoding: https://dicom.nema.org/medical/dicom/current/output/chtml/part05/chapter_6.html

Kairo’s tag names, VRs, UIDs, and definitions come from its provenance-controlled curated dictionary. Required study-query entries are added to that curated source with provenance documented in `app/definitions/DICOM-PROVENANCE.md`; no private dictionary or unrestricted remote definition is accepted.

## 5. Architectural Approaches

### 5.1 Recommended: shared internal C-FIND protocol core with model adapters

Extract the proven association, PDU/PDV, DIMSE command, status, selected-address, cancellation, and bounded-read mechanics from the isolated Checkpoint 7.1 module into an internal C-FIND core. Keep two explicit model adapters:

- the existing MWL adapter retains its public request/result types, SOP UID, dataset shape, projection, classifications, transfer-syntax acceptance, and behavior;
- a new Study Root adapter supplies its SOP UID, study identifier builder, study response decoder/projector, and Q/R-specific validation/result types.

This reuses the protocol state machine without confusing MWL and Q/R information models. It requires exact Checkpoint 7.1 non-regression tests before acceptance.

### 5.2 Rejected: duplicate Study Root client

A separate client copied from `DicomQueryDiagnostics.cs` would initially isolate MWL, but it would duplicate association parsing, Message ID correlation, C-CANCEL races, limits, timeouts, status handling, and security fixes. The two engines would drift.

### 5.3 Rejected: widen the MWL public façade into a generic request

Adding model switches and arbitrary tags to `MwlQueryRequest` or `/api/dicom/mwl/find` would weaken schema boundaries and risk changing accepted MWL behavior. Q/R receives its own typed adapter and authenticated route.

## 6. Component Boundaries

### 6.1 Internal DICOM C-FIND core

The internal core owns only protocol mechanics:

- resolve one endpoint and select exactly one address using the existing deterministic first-address rule;
- establish one TCP connection;
- request one configured abstract syntax and configured Transfer Syntaxes;
- validate the association response and expose the accepted context/syntax;
- send one C-FIND-RQ with one Message ID and one identifier;
- correlate C-FIND-RSP and C-CANCEL to that Message ID;
- retain at most 100 projected results;
- preserve actual response statuses and cancellation outcomes;
- enforce read, size, count, and time bounds; and
- release/close the association once.

The core does not know MWL fields, Study Root fields, browser schemas, persistence, or guidance. It accepts a fixed internal model profile, not user-supplied UIDs or arbitrary tags.

### 6.2 Existing MWL adapter

The MWL adapter remains behaviorally identical. Its route, schema, form defaults, matching/return keys, nested Scheduled Procedure Step structure, supported character sets, result projection, public classifications, 100-result behavior, and UI remain unchanged. Refactoring protocol internals must be invisible to accepted 7.1/7.2 consumers.

### 6.3 Study Root service adapter

A new narrow PowerShell service module:

- validates schema `kairo.study-query.v1` and a strict property allowlist;
- validates endpoint, AE Titles, timeout, and criteria before any network call;
- constructs the typed Study Root request;
- invokes only the fixed Study Root FIND adapter; and
- returns an allowlisted typed result.

It does not accept an SOP UID, Query/Retrieve level, arbitrary dataset, arbitrary tag list, retrieve destination, credentials, or command text from the browser.

The existing authenticated loopback service adds one route, conceptually `POST /api/dicom/studies/find`. All existing authentication, origin, method, request-size, JSON, and error-sanitization boundaries apply. No existing route changes meaning.

### 6.4 Browser model and controller

A focused study-query model builds/validates requests, normalizes the allowlisted response, builds inspector rows, and owns an empty-state factory. A separate UI controller owns the explicit Run, busy gate, rendering, row selection, and Clear action. It mounts once inside the accepted navigation shell and has no access to case/history/profile persistence functions beyond explicit read/fill reuse of compatible DICOM endpoint profiles.

## 7. Request Model and Validation

The browser sends only:

```text
schema: kairo.study-query.v1
host
port
callingAe
calledAe
timeoutMs
criteria:
  accessionNumber?
  patientId?
  studyInstanceUid?
  studyDate?
  modalitiesInStudy?
```

All fields are visible before Run. Endpoint validation reuses the accepted MWL host, port, timeout, and AE Title rules. Unknown, duplicate, array, object-valued, malformed, overlength, leading/trailing-whitespace, wildcard host, path, port-range, and host-range values are rejected locally.

At least one nonempty criterion is required. An all-empty criteria object returns `STUDY_CRITERION_REQUIRED`, leaves every layer `NOT_RUN`, and causes zero API/network calls. Study Date starts blank; no identifying or date criterion defaults. Profile selection/fill does not run a query.

Validation rules:

- Accession Number: visible string, maximum 16 characters, no control characters;
- Patient ID: visible string, maximum 64 characters, no control characters;
- Study Instance UID: one valid DICOM UID, maximum 64 characters; no list is accepted initially;
- Study Date: one exact `YYYYMMDD` value or one explicit closed range `YYYYMMDD-YYYYMMDD`; both endpoints visible, valid calendar dates, start not later than end;
- Modalities in Study: one visible CS value, maximum 16 characters, printable default-repertoire characters, no list or hidden expansion.

User-entered DICOM wildcard characters are not supported in this checkpoint. `*` and `?` in criteria are rejected rather than escaped, broadened, or silently reinterpreted. Kairo does not synthesize universal matching except by sending approved empty return keys.

Local outcomes are distinct from network failure:

- `STUDY_QUERY_NOT_SENT`;
- `STUDY_CRITERION_REQUIRED`;
- `STUDY_INPUT_REJECTED`;
- field-specific endpoint/date/UID/value validation codes.

## 8. C-FIND Identifier

### 8.1 Fixed key

Every request includes:

- Query/Retrieve Level `(0008,0052)` = `STUDY`.

The level is displayed as fixed read-only request context and is not user-editable.

### 8.2 Matching keys

Only explicitly populated criteria are encoded:

- Accession Number `(0008,0050)`;
- Patient ID `(0010,0020)`;
- Study Instance UID `(0020,000D)`;
- Study Date `(0008,0020)`;
- Modalities in Study `(0008,0061)`.

The UI label is **Modalities in Study**, not the series-level singular Modality tag `(0008,0060)`. No Patient Name criterion is included initially. No criterion is removed, widened, case-folded, mapped, or retried after zero matches or failure.

Optional-key support varies by SCP. If an SCP rejects an identifier or does not support an optional matching key, Kairo reports the actual protocol result; it does not retry without that key.

### 8.3 Return keys

The identifier requests these fields with explicit empty values unless the same tag already carries a matching value:

- Specific Character Set `(0008,0005)`;
- Patient Name `(0010,0010)`;
- Patient ID `(0010,0020)`;
- Accession Number `(0008,0050)`;
- Study Date `(0008,0020)`;
- Study Time `(0008,0030)`;
- Study Description `(0008,1030)`;
- Modalities in Study `(0008,0061)`;
- Study Instance UID `(0020,000D)`;
- Number of Study Related Series `(0020,1206)`;
- Number of Study Related Instances `(0020,1208)`;
- Referring Physician’s Name `(0008,0090)`.

An explicitly populated matching tag is not duplicated. No series- or image-level return keys are requested.

## 9. Presentation Contexts and Transfer Syntax

The Study Root adapter proposes one presentation context for Study Root FIND with:

1. Explicit VR Little Endian `1.2.840.10008.1.2.1`;
2. Implicit VR Little Endian `1.2.840.10008.1.2`.

The association accepts only a returned syntax that was proposed for that context. Study Root request encoding and response decoding use the accepted syntax. Unsupported accepted syntax, rejected abstract syntax, malformed context response, or no accepted context is reported without sending C-FIND.

The existing MWL adapter retains its accepted transfer-syntax behavior exactly. Adding Explicit VR decoding for Study Root must not silently change MWL negotiation or parsing.

Association evidence includes the requested Study Root FIND SOP Class, presentation-context result, accepted Transfer Syntax, Calling/Called AE Titles, selected address, and maximum PDU where available. It excludes unrestricted remote payload text.

## 10. DIMSE, Status, and Layered Evidence

One click performs at most one address selection, TCP connection, association, and C-FIND. There is no automatic retry or fallback to another resolved address.

Evidence is reported independently:

```text
DNS → TCP → DICOM ASSOCIATION → STUDY C-FIND → MATCHES
```

Existing DNS/TCP/association classifications are reused where semantically identical. Study C-FIND uses:

- `C_FIND_PENDING` for `0xFF00`;
- `C_FIND_PENDING_WARNING` for `0xFF01`;
- `C_FIND_SUCCESS` for terminal `0x0000`;
- `C_FIND_CANCELLED` for `0xFE00`;
- `C_FIND_REFUSED` for applicable `0xA700` resource-refusal statuses;
- `C_FIND_IDENTIFIER_REJECTED` for applicable `0xA900` identifier/SOP mismatch;
- `C_FIND_FAILURE` for `0xCxxx` or other terminal failure;
- `C_FIND_TIMEOUT`, `C_FIND_ABORTED`, and `C_FIND_MALFORMED` for incomplete transport/protocol outcomes.

Every received status used as evidence is preserved as an unsigned numeric/hex value next to the Kairo classification. Status-detail datasets and unrestricted remote error text are not exposed.

Overall outcomes:

- `SUCCESS_ZERO_MATCHES`: terminal `0x0000`, zero pending identifiers;
- `SUCCESS_MATCHES`: terminal `0x0000`, 1–99 retained studies;
- `SUCCESS_MATCHES_WITH_WARNING`: successful terminal outcome plus material nonfatal protocol/decoding warning;
- `SUCCESS_TRUNCATED`: 100 retained studies and the bounded cancellation path;
- otherwise the specific earliest incomplete/failing layer remains the outcome.

Zero matches is a successful query result, not a PACS connectivity failure and not proof that no study exists under different criteria or at another endpoint.

## 11. Result Bound, C-CANCEL, and Races

Checkpoint 7.3 reuses the proven 7.1 policy without semantic change:

- retain pending study identifiers 1 through 100;
- after retaining item 100, stop accepting further browser-bound results and immediately send C-CANCEL-RQ correlated to the active C-FIND Message ID;
- perform only bounded reads needed to observe a terminal response or cancellation deadline;
- keep overall `SUCCESS_TRUNCATED` regardless of cancellation confirmation;
- preserve all 100 retained studies after final-response races, cancellation timeout, send failure, or association closure;
- record `CANCEL_CONFIRMED`, `FINAL_RESPONSE_RACED_CANCEL`, `CANCEL_TIMEOUT`, `CANCEL_SEND_FAILED`, or `ASSOCIATION_CLOSED_AFTER_CANCEL` separately;
- preserve the actual raced terminal status; and
- never claim the SCP had exactly 100 total matches.

Exactly 100 pending responses still triggers cancellation because the client cannot know whether another result is imminent.

## 12. Parsing, Bounds, and Malformed Responses

All reads remain bounded. The shared core and Study Root adapter enforce at minimum:

- PDU body: 1 MiB;
- command set: 64 KiB;
- one response identifier dataset: 1 MiB;
- 256 parsed elements per study identifier;
- 64 KiB raw length per individual value before allowlisted decoding;
- 100 retained projected study results;
- 4 MiB aggregate decoded/projected result text;
- one active query per controller; and
- existing 100–10,000 ms per-layer timeout with a bounded cancellation deadline.

Lengths, offsets, PDV control flags, presentation-context IDs, command fields, command type, Message ID Being Responded To, dataset presence, response status, VR headers, and element boundaries are validated. Fragmented command/dataset PDVs may be assembled only within the limits. Unexpected commands, wrong message correlation, missing required command fields, invalid VR/length, oversized input, duplicate terminal response, or truncated dataset produces a safe malformed/limit classification and no partial newly malformed item.

Only allowlisted study tags are decoded into results. Unknown elements may expose tag and VR with `UNSUPPORTED/NOT_AVAILABLE` in the selected-row inspector, but their value bytes are discarded. Raw datasets and undecoded bytes never reach the browser, logs, errors, or persistence.

## 13. Character Sets

Reuse the exact approved 7.1 boundary:

- absent Specific Character Set or `ISO_IR 6`: strict DICOM default repertoire;
- `ISO_IR 100`: strict Latin-1;
- `ISO_IR 192`: strict UTF-8.

Unsupported declarations preserve successful protocol status but replace affected human-readable text with `CHARACTER_SET_NOT_SUPPORTED`. Malformed supported text uses `TEXT_DECODING_FAILED`. Warnings contain only the code, tag, keyword, and declared character set—not raw bytes or patient text.

UI/CS/DA/TM/IS values governed by the default repertoire decode and validate independently where appropriate. Kairo never guesses with the workstation locale or replacement characters.

## 14. Study Result Projection

Each retained result is an immutable allowlisted projection containing:

- Patient Name;
- Patient ID;
- Accession Number;
- Study Date;
- Study Time;
- Study Description;
- Modalities in Study;
- Study Instance UID;
- Number of Study Related Series;
- Number of Study Related Instances;
- Referring Physician’s Name;
- Specific Character Set metadata;
- allowlisted tag/keyword/VR/path/value evidence; and
- metadata-only decoding warnings.

The result projection preserves original returned values after only DICOM transport padding is removed. It performs no patient/order matching, case folding, fuzzy matching, modality mapping, UID inference, or date/time synthesis.

## 15. Privacy and Lifecycle

Patient Name, Patient ID, Accession Number, Referring Physician, descriptions, UIDs, dates/times, criteria, and returned values may appear only in the authorized live query form/table/inspector. They are session-only and are never automatically written to:

- cases;
- endpoint profiles or baselines;
- evidence summaries;
- handoffs;
- history;
- application/service/debug logs;
- browser console;
- telemetry;
- URLs or DOM IDs/data attributes;
- exports, clipboard, or external transmission; or
- disk caches or schemas.

Endpoint profiles may supply only their existing nonclinical endpoint fields after explicit Fill. Query criteria and results never flow back into profiles.

**Clear results** synchronously removes the retained result object, table cells, selected row, inspector values, layer/result summaries, decoding warnings, and request snapshot from browser state. **End Session** clears active Q/R results. Reload or browser tab/window closure naturally discards browser memory, and application restart provides no cross-session recovery.

Closing only the local helper prevents further service access but cannot guarantee destruction of content already rendered in an independently open browser tab. That browser memory may remain visible until the analyst selects **Clear results** or **End Session**, reloads the application, or closes the tab/window. The UI and operator guidance state this existing launcher boundary accurately. Checkpoint 7.3 adds no browser process control, forced tab closure, helper-to-browser shutdown signal, browser extension/native messaging, polling, or background lifecycle monitoring.

Remote text is rendered using `textContent`/text nodes only. Values never become HTML, attributes, selectors, logs, or error messages. Generic failures identify codes/layers without echoing criteria or result content.

## 16. UI and Navigation Integration

Add exactly one card to the accepted **Diagnostics** selector:

**DICOM Query / Retrieve**

Description: Query one authorized PACS for matching studies without retrieving or modifying them.

Example: “An accession is complete upstream, but the analyst needs to confirm whether a matching study exists in PACS.”

The shared Quick Guide explains Study Root query-only behavior, explicit narrowing, layered outcomes, successful zero matches, bounded results, session-only PHI, and that no retrieval occurs. The card uses the existing shared designer buttons, breadcrumb, Back behavior, responsive grid, focus rules, and single mounted tool-view architecture.

The focused tool contains:

- heading and explicit **Study Root FIND / QueryRetrieveLevel: STUDY** context;
- saved DICOM profile selection plus explicit **Load profiles** and **Fill endpoint**;
- Host/IP, Port, Calling AE, Called AE, and timeout;
- blank Accession Number, Patient ID, Study Instance UID, Study Date/start/end, and Modalities in Study criteria;
- **Run Study C-FIND** and **Clear results**;
- DNS, TCP, association, C-FIND, matches, actual status, retained/truncated/cancellation, and warning rows;
- a seven-column table: Patient Name, Patient ID, Accession, Study Date, Modalities in Study, Study Description, Study Instance UID;
- a selected-row TAG / KEYWORD / VALUE / DEFINITION inspector; and
- a prominent session-only patient-data notice that accurately explains the helper/browser lifecycle boundary.

Long values wrap safely. The table may scroll horizontally at narrow widths without causing page-level overflow. Selecting a row affects only the inspector. Navigating Back and reopening preserves the active in-session query state under the accepted navigation rule; Clear/session disposal remains authoritative.

No query runs on tool/card/guide opening, profile load/fill, input, row selection, Back/reopen, focus, session start, or date change.

## 17. Acceptance Criteria

1. Diagnostics contains one DICOM Query / Retrieve selector card using the accepted shared card/guide/navigation system.
2. Opening the tool exposes only its existing focused view; no query runs.
3. The UI identifies Study Root FIND and fixed `QueryRetrieveLevel=STUDY`.
4. Patient Root, series/image query, C-MOVE, C-GET, and C-STORE are absent.
5. Endpoint profile fill is explicit and never runs a query.
6. Every criterion starts blank, including Study Date.
7. All-empty criteria are rejected locally with `STUDY_CRITERION_REQUIRED` and zero API/network activity.
8. Each approved criterion is visible and sent exactly when populated; no hidden/widened criterion is added.
9. Wildcard criteria, invalid UID/date/range, unknown properties, and malformed endpoints are blocked locally.
10. One Run click performs at most one selected-address connection, association, and Study Root C-FIND with no retry/fallback.
11. The association proposes only Study Root FIND and the approved Explicit/Implicit Little Endian syntaxes.
12. C-FIND uses the accepted syntax, Message ID correlation, and an identifier containing `STUDY`.
13. Approved matching and empty return keys are encoded with correct tags and VRs.
14. DNS, TCP, association, C-FIND, and matches render separately; later failure preserves earlier success.
15. Association rejection and presentation-context rejection remain distinct from C-FIND failure.
16. Actual numeric/hex status appears beside each applicable C-FIND classification.
17. Terminal `0x0000` plus zero pending identifiers yields `SUCCESS_ZERO_MATCHES`, not a PACS failure.
18. Terminal success with 1–99 results yields `SUCCESS_MATCHES`, subject to warnings.
19. Pending warning `0xFF01` and decoding warnings preserve results and are shown separately.
20. Result 100 triggers correlated C-CANCEL and `SUCCESS_TRUNCATED`; at most 100 results reach the browser.
21. Final/cancel race, cancel timeout/failure, and post-cancel association closure preserve 100 results and accurate separate evidence.
22. Malformed, oversized, uncorrelated, or unsupported responses fail safely within fixed bounds without raw-byte leakage.
23. Approved character sets decode deterministically; unsupported/malformed text uses safe markers without replacement guessing.
24. The table renders seven correctly aligned columns and clearly labels patient-bearing content session-only.
25. Selecting a result renders provenance-controlled TAG / KEYWORD / VALUE / DEFINITION rows without persistence.
26. Remote-looking markup renders literally and cannot create HTML or DOM attributes.
27. Clear removes request/result/selection/inspector/warning/layer state and all patient-bearing DOM text.
28. Back/reopen preserves uncleared session state; Clear results and End Session remove active Q/R results; reload or tab/window closure discards browser memory; restart cannot recover it.
29. Helper closure prevents further service access but does not claim to erase values already rendered in an independently open browser tab; the UI directs the analyst to Clear results, End Session, reload, or close that tab/window.
30. No criteria/result/PHI enters profiles, baselines, cases, evidence, handoffs, history, logs, telemetry, URLs, exports, or disk.
31. Existing MWL zero/match/truncation/cancellation/character-set behavior remains byte- and classification-compatible at its public boundary.
32. Existing C-ECHO and Stage 1–7.2 browser/service workflows remain available and unchanged.
33. The real Windows launcher passes controlled synthetic zero-match, one/multiple-match, inspector, Clear, disposal, and 100-result cancellation acceptance under a standard-user token.

## 18. Testing Strategy

### 18.1 Pure browser/request tests

- blank initial criteria and no default date;
- required narrowing criterion and zero API calls on rejection;
- exact single/range date, UID, accession, Patient ID, and Modalities in Study validation;
- wildcard/unknown/array/object/overlength rejection;
- matching-key/return-key request model;
- response normalization and 100-item guard;
- seven-column projection, selected inspector, safe rendering, and complete Clear;
- no query before explicit Run and busy duplicate suppression;
- Back/reopen state preservation, explicit Clear/End Session disposal, natural reload/tab disposal, and accurate helper-close messaging;
- Diagnostics card/guide/focus/direct-workspace non-regression.

### 18.2 Shared-core and adapter tests

- MWL public fixtures before and after extraction produce identical requests/results/classifications;
- fixed Study Root SOP UID and `STUDY` identifier;
- one presentation context, accepted Explicit/Implicit selection, rejected/unknown syntax;
- Explicit and Implicit request encoding/response decoding;
- fragmented PDV assembly and Message ID correlation;
- pending, warning, success, cancel, refusal, identifier rejection, failure, timeout, abort, and malformed status paths;
- exact numeric status retention;
- every fixed byte/count/time bound;
- unknown-tag value disposal and no raw-byte leakage;
- supported/unsupported/malformed character sets;
- 99, exactly 100, more than 100, final/cancel race, cancel timeout, cancel send failure, and association-close cases.

### 18.3 Service/route tests

- authentication and POST-only behavior;
- strict schema/property validation before runtime invocation;
- empty/invalid criteria produce no controlled-SCP connection;
- one valid request reaches only the typed Study Root adapter;
- sanitized error mapping without criteria/PHI reflection;
- no changes to existing route behavior.

### 18.4 Controlled synthetic SCP

Extend the existing loopback DICOM peer infrastructure with Study Root FIND scenarios using synthetic values only:

- zero matches with terminal `0x0000`;
- one and multiple study identifiers;
- `0xFF01` pending warning;
- association and presentation-context rejection;
- terminal refusal/identifier/failure statuses;
- Explicit and Implicit VR responses;
- supported, unsupported, and malformed character data;
- malformed/oversized/unrelated response;
- 99, exactly 100, and more than 100 identifiers;
- correlated C-CANCEL, race, timeout, send failure, and close-after-cancel;
- observation proving one connection/query and no retry.

No fixture contains real patient data or contacts a non-loopback endpoint.

### 18.5 Real Windows acceptance

Using the normal launcher and a controlled synthetic Study Root SCP under a non-elevated token:

1. verify the selector card, Quick Guide, focused tool, breadcrumb, Back, and no automatic traffic;
2. verify blank/default state and local empty-query rejection with no connection;
3. run explicit zero-, one-, and multiple-match Study Root queries;
4. verify all layers, actual statuses, table alignment, row selection, tag definitions, and text safety;
5. exercise supported/nonfatal character handling;
6. exercise 100-result C-CANCEL and retained-result race/failure behavior;
7. verify Clear, End Session, reload/tab closure, restart non-recovery, and accurate helper-close behavior/messaging; and
8. confirm no retrieval command, UAC/policy change, persistence, logging, automatic retry, discovery, or Stage 1–7.2 regression.

## 19. Non-Regression and Rollback

- Freeze public MWL request/result snapshots and controlled-peer observations before internal extraction; any difference blocks Checkpoint 7.3.
- `EndpointDiagnostics.cs`, C-ECHO routes/controllers, MWL route/schema/controller, Checkpoint 7.2 comparison, profiles, cases, history, and persistence schemas remain unchanged.
- Study Root uses its own authenticated route, validation adapter, browser model/controller, result state, and UI container.
- Shared core extraction is limited to protocol mechanics already needed by both fixed adapters; no arbitrary query API is introduced.
- Study Query runtime unavailability is reported locally while all Stage 1–7.2 tools remain usable.
- Any Stage 1–7.2 regression or unexpected network/persistence behavior blocks acceptance.
- Rollback removes the Study Root route/module/model/controller/card/dictionary additions and restores the internal MWL implementation façade without data migration or deletion.
- No local persisted schema changes exist, so rollback has no data migration.
- Checkpoint 7.4 does not start until 7.3 is manually accepted, committed, and pushed.
