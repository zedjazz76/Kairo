# Stage Seven — DICOM Workflow Diagnostics

Status: product direction and formal architecture approved by the user, September 6, 2026. This design is additive to completed Stage 1–6 functionality. It authorizes specification only; implementation requires a separately approved Checkpoint 7.1 plan. Stage Eight is not approved.

## Objective

Extend the existing Kairo HL7 Toolkit from DICOM file metadata inspection and Verification/C-ECHO into read-only, workflow-level DICOM troubleshooting. Stage Seven helps a PACS, RIS, modality, or clinical-systems analyst determine whether an expected work item or study is reachable, returned, filtered, mismatched, or rejected at a specific protocol layer.

Kairo remains an analyst-directed troubleshooting client. It organizes observed evidence and offers qualified next checks; it does not autonomously remediate, modify, discover, or inventory clinical systems.

## Scope

The Stage Seven roadmap contains five strictly sequential checkpoints:

1. Checkpoint 7.1 — DICOM Modality Worklist C-FIND.
2. Checkpoint 7.2 — MWL/ORM workflow comparison and “Why is this exam missing?” guidance.
3. Checkpoint 7.3 — read-only Query/Retrieve C-FIND.
4. Checkpoint 7.4 — association and SOP/Transfer Syntax capability inspection.
5. Checkpoint 7.5 — read-only SR and GSPS inspection plus workflow tag presets.

Only Checkpoint 7.1 may enter the first implementation plan. It must be implemented, targeted-verified, manually exercised through the real Windows Kairo UI, accepted, and committed/pushed before planning implementation of Checkpoint 7.2.

## Exclusions

Stage Seven does not create a separate application, DICOM-only toolkit, alternate launcher, or replacement architecture. It does not redesign accepted Stage 1–6 features.

The initial Stage Seven scope excludes:

- C-MOVE and C-GET;
- C-STORE or arbitrary image/object transmission;
- Storage Commitment actions;
- PACS modification or deletion;
- endpoint, port, subnet, or AE discovery;
- scanning or unrestricted probing;
- automatic retry, criterion relaxation, wildcard broadening, or date expansion;
- background polling or monitoring;
- packet capture, raw sockets, drivers, installed services, firewall/registry/system changes, or elevation;
- cloud persistence or automatic transmission of PHI;
- third-party DICOM runtimes such as fo-dicom unless an architectural blocker is separately demonstrated and explicitly approved.

## Architecture

Checkpoint 7.1 adds an isolated reusable DICOM query engine without changing `EndpointDiagnostics.cs` or accepted C-ECHO behavior. The query engine is a dependency-minimal C# module compiled in memory by the existing PowerShell helper. Its internal association, DIMSE command, dataset, response, and cancellation boundaries are reusable by a later read-only Study Root or Patient Root C-FIND checkpoint, but Checkpoint 7.1 configures and exposes Modality Worklist Information Model FIND only.

The existing authenticated loopback service gains one narrowly scoped endpoint, `POST /api/dicom/mwl/find`. The separate route avoids coupling MWL request/result limits to the existing `/api/diagnostics/run` contract. PowerShell performs strict request validation before invoking the query engine. The engine returns a bounded structured result; it never returns raw PDUs, command bytes, dataset bytes, unrestricted remote text, or internal exception content.

Browser behavior belongs in focused MWL model/controller modules mounted inside the existing Diagnostics workspace. It reuses existing endpoint profiles, authenticated API access, layered diagnostic presentation, DICOM dictionary/provenance rules, and text-safe rendering patterns. Existing Diagnostics, DICOM file inspection, profiles, baselines, case workflow, and evidence tools remain available.

If optional in-memory compilation is blocked by workstation policy, Kairo reports `MWL_RUNTIME_UNAVAILABLE` for this feature while leaving all Stage 1–6 tools usable. Kairo does not weaken policy or request elevation.

## Checkpoint 7.1 data flow

1. The analyst opens the DICOM Modality Worklist section in the existing Diagnostics workspace.
2. The analyst selects an existing DICOM endpoint profile or explicitly enters one host/IP, port, Calling AE, and Called AE.
3. The query form visibly initializes Scheduled Date to the workstation's current local calendar date when a new/reset form opens. It does not mutate a prepared query across midnight.
4. The analyst reviews or edits all visible criteria. At least one approved narrowing criterion is required.
5. The analyst explicitly selects **Run MWL C-FIND**. No other UI action initiates traffic.
6. Browser validation rejects an unconstrained or malformed request locally. The authenticated service repeats validation independently.
7. The engine resolves one hostname or recognizes one literal IP, selects one address, opens one ordinary user-mode TCP connection, negotiates one association requesting only MWL FIND, and invokes one C-FIND operation.
8. The engine processes bounded pending responses, retains no more than 100 items, and sends a standards-compliant C-CANCEL when the 100th item is retained.
9. The engine waits only within a bounded cancellation/final-response deadline, releases the association when possible, and always closes the socket.
10. The service returns layered technical evidence, actual DICOM status codes, Kairo classifications, match/truncation/cancellation state, decoding warnings, and at most 100 allowlisted items.
11. The browser displays the result table and selected-item inspector in active memory only.
12. **Clear MWL results**, End Session, tab closure, helper closure, or application restart discards the result set and all patient-identifiable values.

## Query and return-key model

Checkpoint 7.1 implements the Modality Worklist Information Model FIND SOP Class defined by DICOM PS3.4 Basic Worklist Management. Matching Keys select worklist entries; explicit empty Return Keys request values. Scheduled Procedure Step attributes are encoded inside a single-item Scheduled Procedure Step Sequence rather than as top-level attributes.

Normative references:

- DICOM PS3.4, Basic Worklist Management Service Class: https://dicom.nema.org/medical/dicom/2026a/output/chtml/part04/chapter_K.html
- DICOM PS3.4, Modality Worklist SOP Class and attribute model: https://dicom.nema.org/medical/dicom/current/output/chtml/part04/sect_K.6.html
- DICOM PS3.7, DIMSE-C services: https://dicom.nema.org/medical/dicom/current/output/chtml/part07/chapter_9.html
- DICOM PS3.8, association and P-DATA structures: https://dicom.nema.org/medical/dicom/current/output/chtml/part08/sect_9.3.html
- DICOM PS3.5, data encoding and character sets: https://dicom.nema.org/medical/dicom/current/output/chtml/part05/chapter_6.html

### Visible matching keys

- Scheduled Procedure Step Start Date `(0040,0002)`, exact date or an explicitly entered date range;
- Modality `(0008,0060)` within Scheduled Procedure Step Sequence `(0040,0100)`;
- Scheduled Station AE Title `(0040,0001)` within that sequence;
- Patient ID `(0010,0020)`;
- Accession Number `(0008,0050)`;
- Requested Procedure ID `(0040,1001)`;
- Requested Procedure Description `(0032,1060)`;
- Requested Procedure Code Sequence `(0032,1064)` using visible Code Value and Coding Scheme Designator inputs that must either both be empty or both be present;
- Scheduled Procedure Step Location `(0040,0011)` where explicitly entered.

All active criteria are visible before Run. An empty form is rejected as `MWL_CRITERION_REQUIRED` with no network activity. The initial Scheduled Date default alone is a valid criterion. Clearing it and every other criterion blocks Run. Kairo never adds hidden criteria, silently converts one date into a broader range, expands a range, removes filters after zero matches, generates a wildcard-all query, or retries automatically.

Checkpoint 7.1 supports an explicit date range. Both endpoints and the exact DICOM range value to be sent are visible. A single date remains a single date and is never silently widened.

### Return keys

The request asks for the fields needed by the analyst table and item inspector, including:

- Specific Character Set `(0008,0005)`;
- Patient Name `(0010,0010)` and Patient ID `(0010,0020)`;
- Accession Number `(0008,0050)`;
- Requested Procedure ID `(0040,1001)`;
- Requested Procedure Description `(0032,1060)`;
- Requested Procedure Code Sequence `(0032,1064)`;
- Study Instance UID `(0020,000D)` where applicable;
- Referenced Study Sequence `(0008,1110)` and requested-procedure references where applicable;
- Scheduled Procedure Step Sequence `(0040,0100)` containing Scheduled Station AE Title, Start Date, Start Time, Modality, Performing Physician, Scheduled Procedure Step ID, Scheduled Procedure Step Description, Scheduled Station Name, and Scheduled Procedure Step Location.

The decoder accepts only a bounded, provenance-controlled set of relevant MWL tags and sequences. Unknown or unsupported elements may expose tag and VR with an unsupported marker, but their value bytes are discarded rather than forwarded. Fixed limits cover PDU size, command size, dataset size, element count, sequence depth, per-value length, aggregate retained-result size, and operation/cancellation time.

## Layered evidence and classifications

Every attempted query reports DNS → TCP → DICOM ASSOCIATION → MWL C-FIND → MATCHES independently. A later failure preserves every earlier successful layer. For example, successful DNS, TCP, and association followed by C-FIND failure remains visible as four distinct facts; it never collapses into a generic “MWL failed.” Subsequent unattempted layers are `NOT_RUN`.

### Local validation

- `MWL_QUERY_NOT_SENT`
- `MWL_CRITERION_REQUIRED`
- `MWL_INPUT_REJECTED`

These are local validation outcomes, not network or DICOM failures.

### DNS and TCP

Reuse established Kairo classifications where applicable:

- `NOT_REQUIRED`, `RESOLVED`, `DNS_FAILED`, `DNS_TIMEOUT`
- `TCP_CONNECTED`, `CONNECTION_REFUSED`, `TIMEOUT`, `UNREACHABLE`, `NETWORK_ERROR`

### Association

- `ASSOCIATION_ACCEPTED`
- `ASSOCIATION_REJECTED`
- `PRESENTATION_CONTEXT_REJECTED`
- `ASSOCIATION_ABORTED`
- `ASSOCIATION_TIMEOUT`
- `ASSOCIATION_MALFORMED`

Association evidence includes Calling AE, Called AE, requested MWL FIND SOP Class, accepted or rejected presentation context, accepted Transfer Syntax, maximum PDU where available, and standards-defined rejection source/reason. It contains no unrestricted remote payload text.

### C-FIND

- `C_FIND_PENDING` for `0xFF00`;
- `C_FIND_PENDING_WARNING` for `0xFF01`;
- `C_FIND_SUCCESS` for terminal `0x0000`;
- `C_FIND_CANCELLED_AT_LIMIT` for the safety-limit cancellation path;
- `C_FIND_CANCELLED` when the terminal response is Cancel;
- `C_FIND_REFUSED` for applicable resource-refusal statuses;
- `C_FIND_IDENTIFIER_REJECTED` for dataset/SOP-class mismatch statuses;
- `C_FIND_SOP_CLASS_NOT_SUPPORTED` where applicable;
- `C_FIND_FAILURE` for other standards-defined failure ranges;
- `C_FIND_TIMEOUT`, `C_FIND_MALFORMED`, or `C_FIND_ABORTED` for incomplete protocol outcomes.

For every response used as evidence, Kairo preserves the actual unsigned 16-bit DICOM status code in numeric/hex form beside its analyst-friendly classification, such as `0x0000 / C_FIND_SUCCESS` or `0xFF01 / C_FIND_PENDING_WARNING`. Only the numeric status and Kairo interpretation are exposed; unrestricted status-detail datasets or remote text are not.

### Overall result and matches

- `SUCCESS_ZERO_MATCHES` requires terminal C-FIND success `0x0000` and zero retained pending-match responses.
- `SUCCESS_MATCHES` requires terminal success with 1–99 retained matches.
- `SUCCESS_MATCHES_WITH_WARNING` represents a successful terminal operation with a material nonfatal protocol or decoding warning.
- `SUCCESS_TRUNCATED` represents the fixed safety-limit path with 100 retained matches.
- A specific earlier-layer or C-FIND failure remains the overall failure classification.

Kairo never infers zero matches from timeout, abort, association closure, malformed response, cancellation, or any incomplete operation.

The UI keeps separate fields for:

- Matches retained/displayed;
- Query truncated: YES/NO;
- Cancellation state.

Displaying 100 items does not claim that the SCP had exactly 100 total matches.

## Cancellation and truncation

- Pending responses 1 through 100 may be retained.
- Immediately after retaining response 100, Kairo stops accepting further items into the browser-bound collection and sends C-CANCEL correlated to the active C-FIND Message ID.
- Kairo continues only bounded protocol reads needed to observe a final response or cancellation deadline.
- Overall classification remains `SUCCESS_TRUNCATED`; truncation is not an SCP/PACS failure.
- Cancellation evidence is separate: `CANCEL_CONFIRMED`, `FINAL_RESPONSE_RACED_CANCEL`, `CANCEL_TIMEOUT`, `CANCEL_SEND_FAILED`, or `ASSOCIATION_CLOSED_AFTER_CANCEL`.
- If the remote final response races with cancellation, Kairo records the actual final status and cancellation state without adding more items.
- Cancel timeout or send failure preserves the already retained 100 results and reports that cancellation was not confirmed.
- Exactly 100 received items still invokes the cap behavior because Kairo cannot know whether another pending response is imminent.
- Kairo does not silently discard additional matches while allowing an unbounded query to continue.

## Character-set handling

Checkpoint 7.1 deterministically supports:

- no Specific Character Set or `ISO_IR 6`: DICOM default repertoire;
- `ISO_IR 100`: Latin-1;
- `ISO_IR 192`: UTF-8.

For any other declared character set:

- successful protocol completion remains successful;
- affected textual fields display `CHARACTER_SET_NOT_SUPPORTED`;
- the UI reports a nonfatal text-decoding warning containing the declared character-set value but no patient text;
- Kairo does not guess with replacement characters or the workstation locale;
- raw undecoded text bytes are discarded and never logged or persisted;
- identifiers governed by default-repertoire VR rules remain available when they decode and validate independently.

Malformed bytes under a supported character set produce bounded field-level decoding warnings and a safe marker rather than corrupting the entire result. The UI distinguishes `QUERY SUCCESS` with `TEXT DECODING WARNING` from `QUERY FAILURE`.

## Privacy and retention

Patient Name and Patient ID may be displayed only in the live authorized MWL table and selected-item inspector. They exist only in the active in-memory result set and never automatically cross into:

- troubleshooting cases;
- endpoint profiles;
- diagnostic baselines;
- handoffs;
- evidence-correlation summaries;
- local history;
- application/debug logs;
- browser console output;
- telemetry;
- error messages;
- exports or external transmission.

The UI identifies patient-bearing columns as session-only. Remote values render through text-safe DOM operations and never become HTML. **Clear MWL results**, End Session, tab closure, helper closure, or restart discards the values. Kairo does not cache responses across sessions.

Any later intentional attachment uses a separately constructed PHI-safe technical projection by default. It may include endpoint, non-patient criteria where practical, match count, modality, Scheduled Station AE, procedure identifiers, scheduled date/time, and protocol classification. Accession inclusion requires an explicit future policy decision and user action. Patient Name and Patient ID are never included automatically.

No request criteria, result values, raw datasets, or PHI-bearing diagnostic objects are written to disk by Checkpoint 7.1.

## UI integration

Add a **DICOM Modality Worklist** area inside the existing Diagnostics workspace. Use a separate MWL controller/model so existing `diagnostics-ui.mjs` and prior workflows are not redesigned.

The area includes:

- existing DICOM endpoint-profile reuse plus explicit host/port/Calling AE/Called AE controls;
- visibly active query criteria;
- a visibly defaulted and editable local Scheduled Date;
- explicit **Run MWL C-FIND** and **Clear MWL results** actions;
- DNS, TCP, Association, C-FIND, and Matches layer rows;
- actual DICOM status and Kairo classification;
- Matches retained, Query truncated, and Cancellation state;
- an explicit statement that zero matches and truncation are not network/PACS failures;
- nonfatal character-set warnings;
- a session-only PHI notice;
- an analyst-friendly results table;
- a selected-item TAG / KEYWORD / VALUE / DEFINITION inspector.

The table exposes the approved core MWL fields. Patient Name and Patient ID are visible only in the live result view. Selecting a row does not persist or attach it.

Nested inspector rows show their sequence path, for example:

```text
Scheduled Procedure Step Sequence (0040,0100)
  → Modality (0008,0060)
  → Scheduled Station AE Title (0040,0001)
  → Scheduled Procedure Step Start Date (0040,0002)
  → Scheduled Procedure Step Start Time (0040,0003)
```

Definitions and UID meanings come only from Kairo's provenance-controlled DICOM dictionary. Missing definitions are labeled unsupported/not available rather than invented or copied from an unapproved source.

No query runs on workspace opening, profile selection, criteria editing, table selection, result inspection, session restore, or midnight rollover.

## Sequential checkpoint roadmap

### Checkpoint 7.1 — DMWL C-FIND

One user-directed MWL query to one configured endpoint; visible criteria; layered evidence; actual status codes; bounded 100-item collection and C-CANCEL; zero-match distinction; session-only table; nested tag inspector; supported character sets.

Stop for targeted verification and real Windows acceptance. Do not begin 7.2 until 7.1 is accepted and committed/pushed.

### Checkpoint 7.2 — MWL/ORM workflow comparison

Explicitly select one in-memory ORM and one MWL result context. Build a PHI-aware normalized comparison of order control, placer/filler numbers, OBR-2/3/4, accession, procedure, modality, location, Scheduled Station AE, Scheduled Procedure Step ID, and visible dates/times. Produce “Why is this exam missing?” OBSERVED / LIKELY BOUNDARY / MISSING EVIDENCE / NEXT CHECK guidance without claiming certainty. No automatic persistence or attachment.

### Checkpoint 7.3 — Query/Retrieve C-FIND

Add read-only Study Root C-FIND using the reusable query engine. Patient Root requires a demonstrated interoperability need and explicit approval. Criteria may include Accession Number, Patient ID, Study Instance UID, Study Date, and Modality. C-MOVE and C-GET remain excluded.

### Checkpoint 7.4 — Association and SOP capability inspector

Expose requested, accepted, and rejected presentation contexts; SOP Classes; Transfer Syntaxes; accepted syntax; maximum PDU; and association rejection source/reason. Explain UIDs and likely workflow roles using provenance-controlled definitions. Do not generalize this into scanning or AE discovery.

### Checkpoint 7.5 — Advanced object inspectors

Design and add separate read-only Structured Report and GSPS inspectors, followed by workflow tag presets for MWL, storage, Query/Retrieve, SR, GSPS, mammography, and general study/series/instance identity. SR and GSPS require separate approved designs because their trees, references, coded content, measurements, annotations, and privacy boundaries differ materially.

## Checkpoint 7.1 acceptance criteria

1. The real Kairo Diagnostics UI exposes the MWL workflow without replacing prior navigation or tools.
2. A new/reset form visibly shows the workstation's current local Scheduled Date.
3. The default date alone permits an explicit query.
4. Clearing every criterion blocks locally with no API or DICOM traffic.
5. Adding any approved visible criterion permits Run; no hidden criterion is added.
6. Profile selection or form editing never initiates a query.
7. One click causes at most one address selection, TCP connection, association, and C-FIND operation against the configured endpoint.
8. DNS, TCP, association, C-FIND, and matches display independently; later failure preserves earlier success.
9. Association rejection and presentation-context rejection remain distinct from C-FIND failure.
10. Each relevant response exposes its actual numeric DICOM status beside the Kairo classification.
11. Terminal `0x0000` with zero pending matches produces `SUCCESS_ZERO_MATCHES`; incomplete operations never do.
12. One match and fewer than 100 matches render correctly with `SUCCESS_MATCHES`, subject to warnings.
13. Exactly 100 retained responses trigger C-CANCEL and `SUCCESS_TRUNCATED` without claiming the SCP total.
14. More than 100 available responses retain/display only 100 and stop collection through C-CANCEL.
15. Final-response/cancel races preserve 100 results and accurately report both final status and cancellation state.
16. Cancel timeout/failure preserves 100 results and reports cancellation as unconfirmed without calling truncation an SCP failure.
17. No automatic retry, filter relaxation, wildcard broadening, or date expansion follows zero matches or failure.
18. No Specific Character Set and `ISO_IR 6` decode using the default repertoire.
19. `ISO_IR 100` and `ISO_IR 192` decode deterministically.
20. Unsupported or malformed character data produces field-level markers and nonfatal warnings without raw-byte leakage or replacement-character guessing.
21. The analyst table displays approved fields, including session-only Patient Name and Patient ID when returned.
22. The item inspector displays TAG, KEYWORD, VALUE, DEFINITION, and visible nested sequence paths using the Kairo dictionary.
23. Clearing results and ending/restarting the session discard the complete result set.
24. Patient Name/ID and raw MWL values never appear in profiles, baselines, cases, handoffs, evidence summaries, history, logs, console output, telemetry, or errors.
25. Inputs, responses, parser work, association reads, cancellation, and memory use are bounded.
26. Existing Stage 1–6 tests and real workflows remain available and unchanged.
27. The actual Windows launcher completes controlled zero-match, matching, inspector, clear-result, and safety behavior under a standard-user token.

## Testing strategy

### Pure request/model tests

- local-date initialization and reset behavior;
- explicit exact-date and date-range encoding;
- required visible narrowing criterion;
- no automatic request, retry, broadening, or mutation;
- matching-key versus empty Return-Key construction;
- single-item Scheduled Procedure Step Sequence structure;
- fixed bounds and rejected malformed inputs.

### Protocol and dataset tests

- association request for MWL FIND only;
- accepted/rejected presentation contexts and Transfer Syntax selection;
- C-FIND command encoding, Message ID correlation, and actual status preservation;
- nested sequence encoding and bounded parsing;
- pending `0xFF00`, pending warning `0xFF01`, terminal success, cancel, refusal, identifier/SOP mismatch, failure, abort, timeout, malformed, and oversized responses;
- fragmented PDU/PDV, command, and dataset delivery;
- no-character-set, `ISO_IR 6`, `ISO_IR 100`, and `ISO_IR 192` decoding;
- unsupported and malformed character data without raw-byte or replacement-character leakage;
- allowlisted projection and unknown-element disposal.

### Controlled loopback SCP tests

- zero matches;
- one match;
- fewer than 100 matches;
- exactly 100 responses;
- more than 100 available responses with correlated C-CANCEL;
- remote final response racing cancellation;
- cancel send failure and cancel timeout while preserving 100 items;
- DNS/TCP/association/C-FIND layer preservation;
- one connection/query and no automatic retries.

Synthetic test values must be used. Test fixtures must not contain real patient data.

### Browser UI tests

- existing navigation plus MWL form availability;
- visible criteria and local validation without API calls;
- explicit single Run behavior and busy-state protection;
- independent layer/status/count/truncation/cancellation rendering;
- zero-match and truncated explanatory copy;
- text-safe table and nested inspector rendering;
- session-only PHI labeling;
- Clear MWL results removes all retained values;
- no case/evidence/handoff propagation;
- existing DICOM, Diagnostics, and Stage 6 UI regressions.

### Real Windows acceptance

- launch through the existing command as a normal non-elevated user;
- query one controlled, explicitly authorized MWL SCP;
- exercise zero-match and matching queries;
- inspect a returned row and nested tags;
- confirm supported/nonfatal text behavior where the controlled SCP permits;
- clear results and verify session disposal;
- exercise the 100-item cancellation boundary against a controlled synthetic SCP when safely available;
- confirm no UAC, policy change, discovery, retry, background traffic, persistence, or automatic transmission.

## Non-regression and rollback expectations

- `EndpointDiagnostics.cs` and accepted C-ECHO behavior remain unchanged.
- MWL uses a separate route, service adapter, query module, browser model, and browser controller.
- Existing endpoint-profile schema remains backward-compatible; Checkpoint 7.1 reuses DICOM host/port/Calling AE/Called AE fields unless a later separately approved need requires an additive field.
- No existing baseline, case, history, message, or DICOM-object schema is widened to accept MWL result content.
- Feature unavailability or failure leaves all Stage 1–6 workspaces usable.
- Checkpoint 7.1 ships only after focused automated verification and real Windows standard-user acceptance.
- Any direct Stage 1–6 regression blocks acceptance.
- Rollback removes the isolated MWL route/module/controller/model/UI section and dictionary additions without migrating or deleting existing local data.
- No later Stage Seven checkpoint begins before the prior checkpoint is accepted and committed/pushed.
