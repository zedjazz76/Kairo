# Stage Seven Checkpoint 7.2 — MWL/ORM Workflow Comparison

**Status — September 7, 2026:** Architectural design prepared for user review. This specification authorizes no implementation. Checkpoint 7.1 is complete at `4d6be13a284112529b84b3eaa22d4c5ed15310ae`; Checkpoint 7.2 code and implementation planning have not started.

## Objective

Add one browser-only, analyst-directed comparison workflow to help answer: **Why does an order exist upstream but not appear correctly on the modality worklist?**

The analyst explicitly selects one currently loaded HL7 ORM message, one structural order group, and either one selected MWL worklist item or one successful zero-match MWL query context. Kairo then produces provenance-preserving comparison rows, concept summaries, and qualified OBSERVED / LIKELY BOUNDARY / MISSING EVIDENCE / NEXT CHECK guidance. The comparison identifies supported mapping, filtering, identity, procedure, location, scheduling, station-AE, and order-lifecycle boundaries without claiming certainty.

## Scope

Checkpoint 7.2 adds:

- explicit selection of one in-memory ORM and, when necessary, one order group;
- explicit selection of one current MWL item when matches exist;
- successful zero-match query-context analysis without inventing an item;
- a comparison-local, session-only HL7 accession-source selector;
- a pure, conservative, provenance-preserving comparison model;
- row-level results, concept-level summaries, and deterministic PHI-safe guidance;
- explicit invalidation and clearing of comparison state; and
- a DICOM Workflow area inside the existing Kairo application.

This work is additive to completed Stage 1–7.1 behavior.

## Exclusions

Checkpoint 7.2 does not:

- redesign the HL7 inspector, DICOM metadata tools, MWL C-FIND, endpoint profiles, diagnostics, evidence correlation, or case workflow;
- modify or initiate an MWL query;
- search a database, another session, history, profiles, baselines, cases, or remote systems;
- automatically choose an ORM, order group, MWL item, patient, accession, or likely match;
- perform probabilistic matching, fuzzy matching, synonym inference, vendor mapping, field-shape inference, or hidden source precedence;
- persist comparison state, source mappings, raw messages, MWL results, PHI, or unrestricted field values;
- attach comparison output to cases, handoffs, evidence summaries, history, profiles, or baselines;
- introduce a global evidence store, background subscription, background recomputation, polling, telemetry, or a new service route;
- implement Checkpoint 7.3 Query/Retrieve, Checkpoint 7.4 association capability inspection, Checkpoint 7.5 SR/GSPS work, or Stage Eight; or
- write an implementation plan before this design is separately approved.

## Architecture

Use a dedicated browser-only workflow-comparison subsystem with four bounded components.

### HL7 ORM adapter

The adapter receives only the explicitly selected parsed in-memory HL7 message. It validates ORM eligibility, derives structural order groups, exposes the selected group's provenance-bearing evidence, and enumerates populated field/component paths for accession-source selection. It does not mutate the message or existing inspector, select a message, infer group ownership from values, infer accession, or persist state.

### MWL adapter

The adapter exposes exactly one of two immutable projections: `SELECTED_ITEM_COMPARISON` or `ZERO_MATCH_QUERY_CONTEXT`. It uses the current Checkpoint 7.1 in-memory result and existing DICOM provenance. It does not invent an item, select a result, persist patient-bearing content, or change query behavior.

### Pure comparison model

The model accepts immutable adapter projections plus the active accession-source choice. It performs conservative concept-specific comparison, preserves every source row, aggregates concept states without hiding rows, and returns deterministic PHI-safe guidance. It has no DOM, network, storage, logging, clock, or controller dependency.

### Workflow comparison UI controller

The controller coordinates explicit source and group selection, accession-source selection, the explicit Compare action, safe rendering, invalidation, and explicit clearing. It consumes narrow read-only snapshots rather than controller internals. It does not create an application-wide store or recompute after a source change.

## Integration contracts

Exact implementation signatures follow existing module conventions, but the interfaces must provide these capabilities:

- HL7 source: obtain a read-only snapshot of the explicitly selected message and an opaque source-generation token.
- HL7 adapter: validate eligibility, derive groups, select one group, and list populated provenance paths within that group.
- MWL source: obtain a read-only snapshot of the current query context, current explicit selected-item identity if any, and an opaque source-generation token.
- Comparison controller: verify both generation tokens immediately before Compare, then pass new projections to the pure model.

The existing workbench and MWL modules may receive only the smallest additive read-only accessor and invalidation hook needed for these contracts. They must not expose mutable state or be reorganized around Checkpoint 7.2.

## Source-selection state machine

HL7 source states:

- `NO_ORM_SELECTED`
- `ORM_SELECTED_INELIGIBLE`
- `ORM_SELECTED_GROUP_REQUIRED`
- `ORM_SELECTED_GROUP_AMBIGUOUS`
- `ORM_SOURCE_READY`

MWL source states:

- `NO_MWL_TARGET`
- `MWL_ITEM_SELECTION_REQUIRED`
- `SELECTED_ITEM_COMPARISON`
- `ZERO_MATCH_QUERY_CONTEXT`

Combined states:

- `READY_TO_COMPARE`
- `COMPARISON_COMPLETE`
- `SOURCE_STALE` or `COMPARISON_INVALIDATED`

Local blocking outcomes are `ORM_REQUIRED`, `ORDER_GROUP_SELECTION_REQUIRED`, `ORDER_GROUP_AMBIGUOUS`, `MWL_RESULT_REQUIRED`, `MWL_ITEM_SELECTION_REQUIRED`, and stale-source invalidation. `ACCESSION_SOURCE_NOT_ESTABLISHED` is nonblocking and produces non-comparable accession evidence.

No transition automatically performs comparison. Source changes discard derived output and require another explicit Compare action. If a selected MWL row disappears because results are cleared or replaced, the target becomes `NO_MWL_TARGET` and the completed comparison is invalidated.

## HL7 ORM eligibility

An explicitly selected message is eligible only when both conditions hold:

1. Parsed `MSH-9` identifies the ORM message family. ORM trigger variants are accepted by the parsed message-family component; eligibility is not based on filename, UI label, description, or guessed content.
2. At least one `ORC` or `OBR` segment exists.

Kairo preserves the exact parsed `MSH-9` value in the source summary. ADT, ORU, SIU, DFT, arbitrary non-ORM messages, ORM messages without ORC/OBR evidence, and messages whose parsed MSH-9 cannot establish ORM membership are rejected locally as `ORM_REQUIRED`. An independently parse-invalid message retains its existing parser outcome and is not reinterpreted as an order.

No message is selected automatically from a multi-message intake.

## Structural order-group derivation

Grouping uses segment order and structural boundaries only:

- An `ORC` begins a group and owns structurally following `OBR` segments until the next `ORC` or another unambiguous order boundary.
- An `OBR` without an owning `ORC` forms an OBR-only group.
- An ORC-only group remains eligible.
- Parser-assigned segment occurrence numbers are retained in all paths.
- Placer/filler numbers, procedure, patient, date, or other values never determine group ownership.

One unambiguous group becomes active after the analyst explicitly selects its ORM. When multiple groups exist, no group is chosen automatically; the analyst must select exactly one. If structure permits more than one plausible ownership relationship, the adapter reports `ORDER_GROUP_AMBIGUOUS`, blocks field-by-field comparison, and identifies the unresolved structure as missing evidence.

The group selector may show group/occurrence number, placer and filler numbers, procedure code/description, scheduled date/time, and location when present. It does not require Patient Name. Values remain session-only. Changing groups never combines ORC evidence from one group with OBR evidence from another.

## Accession-source selection

The active comparison defaults to **HL7 Accession Source: Not established**. The selector lists only actual nonempty field or component paths from the selected group; it has no free-text path entry.

When the analyst selects a source:

- the exact occurrence-aware field/component path is displayed;
- only that path supplies the HL7 side of `ACCESSION`;
- original value and provenance are preserved; and
- no other accession-like field becomes an accession candidate.

When no source is established, accession is `NOT_COMPARABLE`. Guidance reports that the interface-specific accession source is missing and recommends confirming it. Changing ORM or group, clearing comparison, ending the session, or reloading resets the choice. A path such as `OBR[1]-3.1` is never carried to another occurrence or comparison. The choice is not stored anywhere.

## MWL target modes

### Selected-item comparison

`SELECTED_ITEM_COMPARISON` requires a current MWL result containing one or more items and one row explicitly selected by the analyst. Kairo does not choose the first, closest, or best item. Multiple results remain candidate items until selection.

The adapter projects only the selected item's existing allowlisted fields and tag/sequence provenance, plus the parent query's safe protocol classification where needed for guidance. The UI states: **MWL comparison target: Selected worklist item**.

### Successful zero-match query context

`ZERO_MATCH_QUERY_CONTEXT` requires an actual completed `SUCCESS_ZERO_MATCHES` result. The projection contains:

- endpoint;
- visible query criteria actually sent;
- DNS, TCP, association, and C-FIND results;
- actual DICOM status;
- match count zero; and
- zero-match classification.

Kairo creates no synthetic item and no item-level `MISSING_IN_MWL` row. It may compare an ORM value with a query criterion only where the concept registry establishes semantic equivalence. A failed, incomplete, cancelled, cleared, or truncated query cannot enter zero-match mode. Successful zero matches are not described as an MWL failure.

## Normalized comparison model

The result contains mode, source summaries, row-level comparisons, concept summaries, PHI-safe guidance, and safe warnings.

Each row contains:

- stable concept and sub-concept identifiers;
- concept label and value kind;
- exact HL7 segment occurrence plus field/component path;
- original HL7 value;
- exact MWL tag and nested sequence path;
- original MWL value;
- comparison state;
- effective comparison precision when applicable; and
- a safe explanation, including any benign normalization used.

Original values and provenance remain displayed; normalized values are internal aids only.

## Comparison concept registry

Semantic pairings come only from a fixed, provenance-controlled registry. The registry never infers a concept from field shape, proximity, or equality.

| Concept | HL7 evidence considered | MWL evidence considered | Comparison boundary |
|---|---|---|---|
| `IDENTITY` | Group-associated `PID-3` repetitions/components from the selected ORM | Patient ID `(0010,0020)` | Composite identifier comparison; value, namespace, assigning authority, type, and other populated components remain significant |
| `ORDER` | Group-local `ORC-2`, `OBR-2`, `ORC-3`, and `OBR-3` as separate placer/filler sources | Requested Procedure ID `(0040,1001)` and Scheduled Procedure Step ID `(0040,0009)` as distinctly labeled identifiers | Preserve every source; unlike identifier roles are `NOT_COMPARABLE` unless the registry explicitly establishes a counterpart |
| `ACCESSION` | Only the analyst-selected populated path | Accession Number `(0008,0050)` | Comparable only after explicit session-local selection |
| `PROCEDURE` | Group-local `OBR-4` code, coding system, and description components | Requested Procedure Code Sequence `(0032,1064)`, Requested Procedure ID `(0040,1001)`, Requested Procedure Description `(0032,1060)`, and Scheduled Procedure Step Description `(0040,0007)` as distinct evidence | Code+system compares with code+system; descriptions compare only as description evidence; identifiers remain separate |
| `MODALITY` | A group-local field whose approved, version-aware registry entry establishes modality semantics | Nested Modality `(0008,0060)` | Exact comparison only when roles are established; otherwise `NOT_COMPARABLE` |
| `LOCATION` | Approved group-local ORC/OBR location or facility evidence with version-aware provenance | Nested Scheduled Procedure Step Location `(0040,0011)` | Exact text comparison only for established counterpart roles; no location/site mapping inference |
| `SCHEDULE` | Approved group-local requested/scheduled date-time evidence with version-aware provenance | Nested Scheduled Procedure Step Start Date `(0040,0002)` and Start Time `(0040,0003)` | Compare only at compatible explicit precision |
| `STATION_AE` | Only an approved field explicitly established as station-AE evidence | Nested Scheduled Station AE Title `(0040,0001)` | No location-to-AE equivalence; exact trimmed case-sensitive comparison only |
| `ORDER_STATE` | Group-local `ORC-1` | Selected-item presence or successful zero-match context | Lifecycle evidence only, never direct field equality |

The initial registry must include Kairo's already labeled `PID-3`, `ORC-1`, `ORC-2`, `ORC-3`, `OBR-2`, `OBR-3`, and `OBR-4` roles. Additional modality, location, facility, and schedule paths enter a comparable pairing only when their HL7 version-specific semantic role is explicitly defined from approved provenance. Otherwise their evidence is `NOT_COMPARABLE` or concept-level `PARTIALLY_AVAILABLE`; it is not silently omitted or treated as a counterpart. No universal HL7 accession field exists.

Multiple populated HL7 sources for one concept produce separate rows. Equal `ORC-2` and `OBR-2` values remain separate consistent evidence. Conflicting sources remain separate and make the concept ambiguous. No universal preferred source is defined.

## Row-level states

- `MATCH`: established semantic counterparts are equal under the approved narrow rule.
- `MISMATCH`: established semantic counterparts directly and meaningfully differ.
- `MISSING_IN_HL7`: an explicitly established HL7 counterpart is absent while its MWL counterpart is present.
- `MISSING_IN_MWL`: selected-item mode only; an explicitly established MWL counterpart is absent while its HL7 counterpart is present.
- `NOT_COMPARABLE`: semantic equivalence is not established, accession source is unselected, a required code system is absent, or precision cannot safely reconcile.
- `AMBIGUOUS`: established evidence permits multiple interpretations or conflicting components/sources prevent one result.

Missing states are permitted only when the registry establishes the sources as semantic counterparts for the active comparison. An optional or unestablished empty field never creates a missing state. Zero-match mode never produces item-level `MISSING_IN_MWL`.

## Concept-level summaries

Concept summaries reference, but never replace, constituent row IDs:

- `CONSISTENT`: all populated comparable evidence agrees.
- `AMBIGUOUS`: same-concept sources conflict, or row results cannot support one interpretation.
- `PARTIALLY_AVAILABLE`: some concept evidence exists but other relevant evidence is absent or unestablished.
- `NOT_COMPARABLE`: no safe semantic pairing exists.

A mixture of row-level matches and mismatches is concept-level `AMBIGUOUS`. All contributing rows remain visible.

## Conservative normalization

For comparison only, Kairo may remove DICOM transport padding, trim surrounding whitespace, and apply delimiter-padding behavior already established by the parser. If trimming affects evaluation, the explanation states: **Compared after trimming surrounding whitespace.**

Kairo does not case-fold, remove punctuation or words, transliterate, fuzzy-match, infer synonyms, discard populated components, or apply vendor mappings.

- Composite identifiers compare component-by-component. Equal primary values with differing assigning authority, namespace, identifier type, or another material populated component are not a simple match.
- Identifier, AE Title, location, site, code, and text case remains significant.
- Codes require code value plus coding system. Same code with different systems is `MISMATCH`; missing required system is `NOT_COMPARABLE`.
- Descriptions compare separately as exact trimmed case-sensitive text and never establish coded-procedure equivalence.
- Dates/times parse only supported valid HL7/DICOM representations. The result identifies effective precision: date, minute, second, or fractional second as applicable.
- Date/time comparison requires compatible explicit precision. Date-only versus timestamp is `NOT_COMPARABLE`; multiple valid interpretations are `AMBIGUOUS`. No timezone is invented.

## Ambiguity and conflict handling

- Structural ambiguity blocks extraction as `ORDER_GROUP_AMBIGUOUS`.
- Same-concept source conflicts preserve every row and yield concept-level `AMBIGUOUS`.
- Unestablished semantic equivalence yields `NOT_COMPARABLE`, not a manufactured mismatch or missing state.
- Multiple plausible value interpretations yield `AMBIGUOUS`.
- Missing evidence describes only the selected sources and never becomes a causal claim.

`ORC-1` cancellation/change evidence plus a returned item is lifecycle tension only. Kairo never claims the selected item corresponds to that order without independent evidence.

## Four-part guidance

Guidance is deterministic and uses fixed templates plus safe concept labels, provenance paths, comparison states, protocol codes, and counts. It never interpolates Patient Name, Patient ID, accession values, raw messages, raw MWL values, unrestricted remote text, or free-form clinical content.

Each result contains:

- `OBSERVED`: facts directly present in selected evidence;
- `LIKELY BOUNDARY`: usually one best-supported qualified boundary; two may be named only when genuinely tied;
- `MISSING EVIDENCE`: evidence needed to distinguish remaining explanations; and
- `NEXT CHECK`: one to three bounded, user-directed actions.

Guidance priority is:

1. source eligibility, selection, or structural ambiguity;
2. query completeness and protocol state;
3. successful zero-match evidence;
4. lifecycle tension;
5. established semantic mismatches;
6. same-concept source conflicts;
7. missing established counterparts;
8. partial or non-comparable evidence; and
9. consistent evidence.

Core rules include:

- Eligible ORM plus successful zero matches: upstream order evidence exists; the query completed successfully; zero items matched the shown criteria. The likely boundary is qualified as ingestion, MWL generation, filtering, or mapping, narrowed by available criteria. Next checks verify the exact criteria and corresponding receiver-side mapping/filter evidence.
- Modality mismatch: procedure-to-modality mapping or selected-item mismatch may be involved.
- Established location mismatch: location/site mapping or filtering may be involved.
- HL7 location versus Station AE without an approved mapping: `NOT_COMPARABLE`; request location-to-station mapping evidence.
- Cancellation/change evidence plus a selected item: cancellation propagation or worklist lifecycle may be involved; correspondence is not proven.
- Conflicting ORC/OBR identifiers: interface source-of-truth mapping is the best-supported boundary.
- Code/system mismatch: procedure-code mapping, coding-system translation, or selected-item mismatch may be involved; description agreement does not override it.
- Predominantly consistent selected-item evidence: the selected evidence does not isolate why another exam is missing; confirm the intended item and inspect receiver-side filtering/lifecycle evidence.

The words **root cause**, **proved**, and equivalent certainty are excluded from Checkpoint 7.2 guidance templates.

## Privacy

All Checkpoint 7.2 source and derived state remains in browser memory for the active session.

- The HL7 adapter reads the active parsed message without sending it to the helper.
- The MWL adapter reads the retained browser result without a new API call.
- The pure model receives only selected projections needed for comparison.
- Patient-identifiable values may appear only in the live comparison when already present in explicitly selected evidence.
- The four-part guidance is PHI-safe by construction.
- Rendering uses `textContent` or created text nodes; remote/source content never becomes HTML.
- Fixed safe error codes and descriptions never echo source values.
- Values are not placed in URLs, DOM IDs/attributes, console output, logs, telemetry, analytics, or error strings.

Checkpoint 7.2 adds no storage schema or route. It never automatically writes raw HL7, raw MWL results, Patient Name, Patient ID, accession, unrestricted values, comparison output, or accession-source choices to cases, profiles, baselines, history, handoffs, files, browser storage, logs, or telemetry. Any future attachment requires a separately approved PHI-safe projection and policy.

## Lifecycle and invalidation

The controller retains only explicit selections, opaque source-generation tokens, and the latest derived comparison.

- ORM change clears group selection, accession selection, and result.
- Group change clears accession selection and result.
- MWL row change clears the result.
- New, replaced, or cleared MWL results clear target and result; a disappeared selected row transitions to `NO_MWL_TARGET`.
- Query-form edits do not rewrite already retained evidence, but the comparison identifies the retained query context and generation.
- A new completed query invalidates the prior target and comparison.
- Explicit **Clear comparison** clears the accession-source choice, MWL comparison target, rows, summaries, and guidance. It retains the explicitly selected ORM and unambiguous/explicit order group, and it does not clear the underlying HL7 intake or MWL results.
- End Session, tab close, or reload discards all Checkpoint 7.2 state.

Immediately before Compare, source tokens must still match current evidence. Stale evidence blocks comparison as `SOURCE_STALE` or `COMPARISON_INVALIDATED`. No invalidation automatically selects, compares, recomputes, reruns a query, or changes source workflows.

## UI integration

Add a **DICOM Workflow** area inside the existing Kairo application with **Compare ORM to MWL** and the question **Why is this exam missing?** It is not a separate application and does not replace existing workspaces.

The area shows:

- selected HL7 ORM identity and exact MSH-9;
- eligibility state and `ORM_REQUIRED` reason when applicable;
- selected order group and its ORC/OBR occurrences;
- a concise order-group selector when multiple groups exist;
- visible **HL7 Accession Source** selector, defaulting to **Not established**;
- MWL target mode, query identity/status, candidate count, and selected-row identity where applicable;
- explicit **Compare ORM to MWL** and **Clear comparison** actions;
- comparison rows and concept summaries; and
- OBSERVED / LIKELY BOUNDARY / MISSING EVIDENCE / NEXT CHECK.

The MWL target label is **Selected worklist item** or **Successful zero-match query context**. Multiple MWL candidates remain visibly unresolved until the analyst selects one.

The comparison table columns are:

| CONCEPT | HL7 SOURCE | HL7 VALUE | MWL SOURCE | MWL VALUE | RESULT |
|---|---|---|---|---|---|

Explanations and normalization notes appear in an adjacent detail region or accessible row detail without hiding provenance. Long values wrap. States are conveyed by text and accessible semantics, not color alone. Patient-bearing values carry a session-only notice. No source content is rendered as HTML.

The controller does not subscribe to background data matching. Narrow source-invalidation notifications may clear stale state but never run Compare.

## Acceptance criteria

1. Checkpoint 7.1 remains complete and its MWL form, query, result table, inspector, and Clear behavior remain unchanged except for the smallest read-only selection/invalidation contract.
2. Existing HL7 inspection remains unchanged except for the smallest read-only selected-message contract.
3. Comparison is browser-only, session-only, and initiated only by explicit Compare.
4. No loaded message is selected automatically.
5. ORM+OBR, ORM+ORC, and ORM+ORC+OBR are eligible; non-ORM+OBR and ORM without ORC/OBR return `ORM_REQUIRED`.
6. Malformed/unknown MSH-9 returns `ORM_REQUIRED` or retains an existing parse-invalid state without reinterpretation.
7. Multiple loaded messages require explicit selection.
8. One structural group may activate only after explicit ORM selection; multiple groups require explicit group selection.
9. ORC-only and OBR-only groups are supported; group ownership is structural only.
10. Ambiguous grouping blocks comparison; conflicting groups are never merged.
11. Selecting or switching a group deterministically changes provenance and clears accession/result state.
12. With MWL matches, no row is auto-selected and Compare remains blocked until one current row is explicitly selected.
13. A selected-item comparison uses only that item's allowlisted provenance-bearing values.
14. A successful zero-match result uses actual query/protocol context, is not called a failure, and creates no item or item-level missing rows.
15. Cleared/replaced MWL results remove the target and invalidate comparison.
16. Accession defaults to Not established and `NOT_COMPARABLE`; explicit selection from a populated group-local path enables comparison.
17. Accession selection is cleared by ORM/group change, explicit Clear, session end, and reload; it is never inferred or persisted.
18. ORC-2/OBR-2 and ORC-3/OBR-3 sources remain separate; agreement and conflict are represented without source precedence.
19. Only registry-established semantic counterparts can produce match, mismatch, or missing states.
20. Missing states are never created from optional/unestablished empty fields; zero-match mode never emits item-level `MISSING_IN_MWL`.
21. Original values and exact HL7/DICOM provenance remain visible for every row.
22. Composite identifiers retain namespace, authority, type, and other populated components.
23. Whitespace/padding is the only benign general normalization; case differences remain meaningful.
24. Same procedure code and system can match; different systems mismatch; a missing required system is not comparable.
25. Description agreement never proves coded-procedure equivalence; fuzzy matching and vendor mappings do not occur.
26. Dates/times compare only at compatible explicit precision and never invent timezone information.
27. Concept summaries never replace or hide row evidence.
28. Four-part guidance is deterministic, qualified, PHI-safe, and offers at most three bounded next checks.
29. Cancellation/change evidence plus an item is described only as lifecycle tension.
30. Source changes invalidate output without automatic recomputation; stale tokens block Compare.
31. Explicit Clear removes accession/target selections and all derived comparison values without clearing the selected ORM/order group or underlying HL7/MWL sources.
32. End Session/reload leaves no Checkpoint 7.2 state.
33. No comparison content, PHI, accession, source mapping, or unrestricted value reaches profiles, baselines, cases, handoffs, history, logs, telemetry, browser storage, or a helper route.
34. Existing Stage 1–7.1 automated and manual contracts remain intact.

## Testing strategy

All fixtures use synthetic values. No test performs clinical network access.

### Pure HL7 adapter tests

- ORM with OBR, ORC, and both; each is eligible.
- Non-ORM with OBR and ORM without ORC/OBR return `ORM_REQUIRED`.
- Unknown/malformed MSH-9 follows the approved local/parser outcome.
- No selected message and multiple loaded messages do not cause automatic selection.
- Single ORC/OBR, ORC-only, and OBR-only groups preserve exact occurrences.
- Multiple groups require explicit selection; each selection exposes only that group.
- Conflicting cross-group values never merge.
- Structurally ambiguous ownership blocks comparison.
- Switching groups changes provenance deterministically.

### Pure MWL adapter tests

- Matches require explicit current-row selection.
- Selected-item mode projects only the selected allowlisted item and nested paths.
- Multiple items remain candidates; none is ranked or auto-selected.
- `SUCCESS_ZERO_MATCHES` projects actual criteria, layers, status, and zero count without an item.
- Failure, incomplete, cancel, truncation, clear, replacement, and stale selection do not enter zero-match mode.
- Clear/replacement transitions to `NO_MWL_TARGET`.

### Accession-selection tests

- Default is Not established and accession is `NOT_COMPARABLE`.
- Choices come only from populated active-group paths; free text is impossible.
- Explicit selection enables only that path.
- Other accession-like fields remain non-accession evidence.
- ORM/group change, Clear, end/reload reset selection; no state is persisted or reused.

### Pure comparison tests

- Equal and conflicting ORC-2/OBR-2 and ORC-3/OBR-3 remain separate rows with correct aggregation.
- Registry-unestablished roles and optional empty fields do not create missing states.
- Zero-match context emits no item-level `MISSING_IN_MWL`.
- Whitespace-only differences are explained; case differences remain material.
- Composite identifiers compare all populated components; differing authority/namespace is not a simple match.
- Code+system equality matches; system difference mismatches; missing system is not comparable.
- Description agreement does not override coded evidence.
- Compatible date/time precision compares; incompatible precision is not comparable; multiple interpretations are ambiguous.
- Original inputs and projections remain unchanged.
- No fuzzy text, location, modality, procedure, or AE matching occurs.

### Guidance tests

- Successful zero-match, modality mismatch, established location mismatch, location-versus-AE non-comparability, cancellation lifecycle tension, source conflict, coded-procedure mismatch, and predominantly consistent evidence select the approved qualified templates.
- One best-supported likely boundary is preferred; tied boundaries remain concise.
- Next Check contains one to three bounded actions.
- Guidance never emits patient, accession, raw-message, raw-MWL, or free-text canaries.
- No template uses root-cause certainty language.

### UI/controller tests

- Explicit ORM, group, MWL target, accession, Compare, and Clear workflows.
- All local blocking states and accessible explanations.
- Six aligned comparison columns, wrapped long values, text-safe remote content, and state labels independent of color.
- Multiple groups/items remain unselected until explicit action.
- Source changes and stale tokens clear/block output without recomputation.
- Selected-item and zero-match labels are correct.
- Patient-bearing values appear only in the live session-only table.
- Clear and session teardown remove all comparison-local values.

### Privacy and non-regression tests

- Synthetic PHI/accession canaries never reach API calls, history events, profiles, baselines, case attachments, handoffs, browser storage, console output, logs, or errors.
- No new service endpoint or persistence schema exists.
- Existing parser, workbench, MWL model/UI, diagnostics, case, DICOM, history, and UI-contract suites remain green.
- Real Windows manual acceptance uses synthetic ORM/MWL evidence and verifies explicit selection, both target modes, provenance, comparison states, qualified guidance, wrapping/alignment, invalidation, and Clear behavior.

## Non-regression expectations

- No existing automatic history behavior is widened to include comparison content.
- No existing case/evidence projection accepts comparison data.
- No endpoint-profile or baseline schema changes.
- No MWL request, C-FIND, cancellation, result-cap, charset, inspector, or Clear behavior changes.
- No HL7 parse/edit/sanitize/send/history behavior changes.
- No diagnostic evidence-correlation templates are repurposed for PHI-bearing comparison output.
- No Checkpoint 7.3+ capability enters the tree.

Checkpoint 7.2 must pass focused pure/controller/privacy tests, affected existing suites, and real Windows synthetic manual acceptance before completion.

## Rollback

Rollback removes the dedicated ORM adapter, MWL adapter, pure comparison model, workflow comparison controller, its UI section/styles/tests, and the narrow read-only source accessors/invalidation hooks. Because Checkpoint 7.2 creates no persistence schema, service route, migration, saved mapping, or durable comparison record, rollback requires no data migration or deletion. Completed Stage 1–7.1 behavior and stored data remain intact.

## Completion gate

After this specification is approved, create a separate implementation plan using `superpowers:writing-plans`. Do not implement Checkpoint 7.2 until that plan is reviewed under the applicable workflow. Do not begin Checkpoint 7.3, association capability inspection, SR/GSPS work, or Stage Eight.
