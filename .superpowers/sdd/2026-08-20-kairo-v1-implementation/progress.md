# SDD ledger — plan: docs/superpowers/plans/2026-08-20-kairo-v1-implementation.md

Workspace: C:/Users/rdunn/Documents/Codex/2026-08-20/referenced-chatgpt-conversation-this-is-an/.worktrees/kairo-v1
Branch: kairo-v1
Merge base: 84075ac
Remote: https://github.com/zedjazz76/Kairo.git

## Preflight scan

### Per-task internal consistency

| Task | Files/tests/steps agree? | Finding |
|---|---|---|
| 1 | Mostly | The red contract test needs a minimal Node test harness and lockfile before `pnpm install --frozen-lockfile` can run. |
| 2 | Yes | Domain types, projection tests, and produced interfaces align. |
| 3 | Yes | Context domain types consume Task 2 identifiers and evidence consistently. |
| 4 | Yes | Repository contract, Room adapter, and migration tests align. |
| 5 | Yes | Vault, sensitive-content policy, archive round trip, and boundary tests align. |
| 6 | Yes | Required launch formats, resumable stages, and candidate outputs align. |
| 7 | Yes | Candidate decisions and human-gated promotion align. |
| 8 | Yes | Hybrid retrieval inputs, ranking tests, and index ports align. |
| 9 | Mostly | `verify(exactly = 0)` asserts provider non-invocation; acceptable only if a specific recording fake makes the cost/routing boundary observable. |
| 10 | Yes | Deep Analyze and time-aware Trace consume the established retrieval and reasoning contracts. |
| 11 | Yes | Android UI consumes Core capabilities and owns protected/offline presentation only. |
| 12 | Mostly | The example `captureRoutedFrame` must be a test-transport observation, not a production-only-for-tests broker method. Model requests and ciphertext tunnel frames must remain separate relay channels. |
| 13 | Yes | Browser workspaces consume Task 12 tunnel commands and do not create another knowledge store. |
| 14 | Yes | Manifest-driven imports consume the ingestion/memory/retrieval boundaries and preserve authority. |
| 15 | Yes | The release gate consumes all prior capabilities; full-run commands match the planned toolchains. |

### Shared-file and interface pairs

| Producer task | Consumer task | Shared file/interface | Finding |
|---|---|---|---|
| 1 | 2 | contract enum names → Kotlin domain enums | Mapping/parity tests are required; no conflict. |
| 1 | 9 | `KairoAnswerV1` → answer validation | Required fields match Task 9 evidence firewall. |
| 1 | 12 | `CoreCommandV1` → encrypted tunnel | Versioned envelope is compatible with encrypted transport. |
| 2 | 3 | IDs/scopes/evidence/time → context domain | Compatible. |
| 2 | 4 | `FactVersion` → `KnowledgeRepository`/Room | Append-only persistence matches projection semantics. |
| 2 | 8 | scopes/states/time → ranking | Compatible. |
| 3 | 4 | source/workflow/project/incident records → Room | Compatible; normalized mapping belongs to Task 4. |
| 3 | 6 | Capture Session/anchors → ingestion | Compatible. |
| 3 | 10 | workflow/project/incident → Trace/Deep Analyze | Compatible. |
| 4 | 5 | source metadata repository → Source Vault | Blob storage remains outside Room; metadata and hashes remain authoritative links. |
| 4 | 7 | repository/audit → promotion | Transaction boundary is explicit. |
| 4 | 8 | repository → hybrid retriever | Compatible. |
| 5 | 6 | vault/security decision → pipeline | PHI gate precedes durable promotion and cloud reasoning. |
| 5 | 15 | archive/security behavior → release gate | Encrypted round trip and exclusion checks are owned by Task 5. |
| 6 | 7 | `MemoryCandidateDraft` → Memory Inbox | Compatible. |
| 6 | 13 | capture progress/PHI decisions → desktop UI | Compatible through Core commands. |
| 6 | 14 | ingestion pipeline → Genesis importer | Compatible. |
| 7 | 11 | Memory Inbox service → Android UI | Compatible. |
| 7 | 13 | Memory Inbox service → desktop UI | Compatible through Core commands. |
| 8 | 9 | `EvidenceBundle` → Quick/Reasoning | Compatible. |
| 8 | 10 | expanded retrieval → Deep Analyze | Compatible. |
| 8 | 14 | benchmark retrieval → Genesis validation | Compatible. |
| 9 | 10 | `ReasoningProvider`/validator → Deep Analyze | Compatible. |
| 9 | 11 | validated `KairoAnswer` → Android Copilot | Compatible. |
| 9 | 13 | validated `KairoAnswer` → desktop Copilot | Compatible through generated contracts. |
| 10 | 11 | Trace/Deep results → Android | Compatible. |
| 10 | 13 | Trace/Deep results → desktop | Compatible. |
| 11 | 12 | Android Core host → tunnel client | Compatible; one authoritative Core retained. |
| 12 | 13 | paired tunnel → browser workspaces | Compatible. |
| 13 | 15 | desktop batch/capture/query → end-to-end gate | Compatible. |
| 14 | 15 | Genesis fixtures/benchmarks → release gate | Compatible. |

## Rulings

Ruling: Work locally against the configured GitHub destination but do not push while `zedjazz76/Kairo` is public — the locked design requires a private repository and contains institutional-sensitive architecture — cost if wrong: the remote remains empty until privacy is changed and push is separately authorized.

Ruling: In Task 1, create only the minimal workspace/test-runner scaffolding needed to execute the red contract test, then observe the schema behavior fail before implementing the schema — this preserves TDD without pretending a nonexistent runner can execute — cost if wrong: bootstrap may differ slightly from the literal command order while preserving every behavior and deliverable.

Ruling: In Task 9, test provider non-invocation through a specific recording fake because avoiding an unnecessary frontier call is an observable routing/cost contract, not through a generic mock-existence assertion — cost if wrong: the test may become coupled to the provider port and require refactoring if routing boundaries change.

Ruling: In Task 12, observe ciphertext with an injected test transport and keep broker production APIs free of test-only capture methods; encrypted Core tunnel frames and sanitized model-gateway requests are separate relay channels — cost if wrong: the transport abstraction adds one small interface but prevents test-only production surface and accidental ciphertext/model conflation.

Ruling: The official portable JDK 17 download timed out through both approved Windows transfer methods, so Task 1 must complete and verify the Node contract/workspace slice with bundled runtimes and may scaffold—but must not falsely claim execution of—the Gradle slice; the missing JDK is carried as DONE_WITH_CONCERNS into review — cost if wrong: Kotlin build verification is delayed and Task 1 may require a focused fix round when a JDK becomes available.

## Progress

Task 1: preflight complete; BASE 84075ac.
Task 1: minor (deferred): `verifyContracts` is a placeholder Gradle task and is not yet connected to the contract suite; final review must triage after a working Gradle wrapper exists.
Task 1: reviewer ⚠️ resolved by controller: `.gitignore` predates the task diff and contains the required worktree, dependency, build, IDE, local config, secret, and validation-report exclusions.
Task 1: reviewer ⚠️ open environment constraint: Gradle entry point cannot be verified because the checkout and machine have no wrapper/JDK/Gradle; official JDK download attempts timed out.
Task 1: fix round 1/5 (4 addressed, 1 open — approved command payloads remain arbitrary; commits ae00e6f..c16ed3f).
Task 1: fix round 2/5 (1 addressed, 0 contract findings open; commits c16ed3f..899709e).
Task 1: environment update: official Temurin JDK 17.0.20.8 and Gradle 9.6.1 were downloaded to the ignored work area; both package/distribution hashes were verified by their package channel or official Gradle checksum.
Task 1: fix round 3/5 replaced the placeholder with a real cross-platform Gradle contract gate and official SHA-pinned wrapper; Gradle `tasks`, `verifyContracts`, and `check` passed with 12/12 contract tests (commit 2d2b8cc).
Task 1: fix round 4/5 corrected the POSIX wrapper mode from 100644 to 100755 and ignored the workspace-local `work/` cache; independent re-review CLEAN (commit 3ca91d0).
Task 1: COMPLETE; commit range 84075ac..3ca91d0; final controller verification `gradlew.bat verifyContracts --no-daemon` passed 12/12, `git diff --check` passed, and the worktree was clean.
Task 2: preflight complete; BASE 3ca91d0.
Task 2: initial review CHANGES_REQUIRED — same-scope current successors did not retire predecessors; caller-owned evidence/projection collections could mutate validated snapshots; scope/time/determinism coverage needed strengthening (commit f1b3469).
Task 2: fix round 1/5 implementation committed at b844ac8; 14 focused temporal tests and 12 contract tests reported green; scoped rereview was interrupted before verdict.
Task 2: recovery checkpoint reconciled at b844ac8 — branch/worktree clean, review package `review-f1b3469..b844ac8.diff` present, offline controller verification `:core:domain:test verifyContracts` successful with 12/12 contracts; resume at scoped rereview, do not redispatch implementation.
Task 2: fix round 1/5 rereview (3 original findings addressed, 1 new Important open — duplicate `FactId` input makes projection last-write-wins and order-dependent; commits f1b3469..b844ac8).
Task 2: Ruling: reject duplicate `FactId` values at projection ingress rather than defining last-write-wins resolution — fact identity must be globally unambiguous for append-only history and later persistence — cost if wrong: malformed imported histories fail fast and require upstream ID repair instead of being projected best-effort.
Task 2: fix round 2/5 (1 addressed, 0 open — duplicate `FactId` ingress now rejected deterministically; commits b844ac8..25941eb).
Task 2: complete (commits 3ca91d0..25941eb, review clean). Fresh forced controller verification executed 16 domain tests with 0 failures/errors/skips and 12 contract tests with 0 failures; `git diff --check` passed and worktree was clean.
Environment update: user confirmed `zedjazz76/Kairo` is now private. The privacy condition in the earlier no-push ruling is resolved; push/publish remains unperformed pending explicit authorization for that external side effect.
Task 3: preflight complete; BASE 25941eb.
Task 3: initial review CHANGES_REQUIRED at 1a377fc — source lineage/anchor coherence missing; candidate anchors not tied to Capture Session; project architectures can leak MANA production scope; project collection IDs/references are ambiguous; active workflows/steps can lack evidence; Spec FAIL and Quality FAIL.
Task 3: controller-confirmed spec gap — `ProjectStatus` omitted the locked Idea, Discovery, Implementation, Validation, Go-Live, Hypercare, Completed, and Historical lifecycle distinctions; include in fix round 1.
Task 3: minor (deferred): most context records retain reference equality rather than value semantics; final whole-branch review must triage whether consistent value semantics are required before merge.
Task 3: Ruling: `Source` top-level hash/import metadata identifies the root captured variant; require one root variant with matching metadata, unique variant IDs and version numbers, resolvable earlier-parent lineage, and source anchors equal the union of retained variant anchors — this makes provenance deterministic for Task 4 persistence — cost if wrong: sources whose top-level metadata was intended to mean “latest variant” will require a model adjustment.
Task 3: fix round 1/5 rereview (3 addressed, 3 open — candidate, Project architecture, and WorkflowStep invariants validate caller-owned collections instead of stored snapshots; commits 1a377fc..2b21c8d).
Task 3: fix round 2/5 (3 addressed, 0 open — candidate, Project architecture, and WorkflowStep invariants now validate stable stored snapshots; commits 2b21c8d..4114ef3).
Task 3: complete (commits 25941eb..4114ef3, review clean). Fresh forced controller verification executed 33 domain tests with 0 failures/errors/skips and 12 contract tests with 0 failures; `git diff --check` passed and worktree was clean.
Task 4: preflight complete; BASE 4114ef3.
Task 4: Ruling: add explicit `FactLineageId` to `FactVersion`, defaulting new roots from `FactId` and preserving lineage through `copy`, because the Task 4 repository contract and locked history model require lineage although Task 2’s field list omitted it — cost if wrong: serialized/domain shape changes before persistence and callers must distinguish version ID from lineage ID.
Task 4: Ruling: this machine has no Android SDK or connected device; implement and compile-check the instrumentation migration test, add an equivalent JVM-executable Room/Robolectric migration and repository gate, and defer actual `connectedDebugAndroidTest` device execution to the Android/release environment — cost if wrong: device-only SQLite/Room behavior may remain undiscovered until that later gate.
Task 4: Ruling: source content identity is normalized separately from source import records so a unique content hash can deduplicate bytes without preventing multiple imports/metadata records required by Task 5 — cost if wrong: the schema has one extra identity table and mapping join.
Task 4: dependency baseline verified from official repositories on 2026-08-20: AGP 9.3.1, Room 2.8.4, AGP-bundled Kotlin 2.2.10, and matching KSP 2.2.10-2.0.2; compileSdk/targetSdk 36 and minSdk 26 are the working V1 baseline unless tool verification forces a ledgered compatibility adjustment.
Task 4: implementation committed at fff8488 (`feat: persist authoritative evidence graph with Room`); forced controller verification executed all 47 Gradle tasks successfully, including 36 domain tests, 9 Android JVM tests, 12 contract tests, and instrumentation-test compilation; connected-device execution remains deferred by ruling.
Publish checkpoint: user explicitly authorized commit and upload; branch `kairo-v1` through fff8488 pushed to private `zedjazz76/Kairo` and verified locally against upstream. Task 4 independent review is the next incomplete gate.
Environment handoff: user designated their established Android-development laptop for later device/emulator build verification and requested continued implementation until a genuinely Android-only gate. Maintain clean pushed checkpoints and leave the private GitHub branch plus this recovery ledger ready for Ubuntu-server continuation; server transfer awaits connection/access details.
Task 4: initial review CHANGES_REQUIRED at fff8488 — repository `currentUnderstanding` filters by subject/predicate before domain supersession, so a successor that changes either key can leave stale predecessor knowledge current. Minor deferred: enforce same-source parent variant lineage in SQLite; strengthen migration evidence/temporal assertions.
Task 4: fix round 1/5 (1 addressed, 0 open — complete authoritative history is projected before optional subject/predicate filtering; commits fff8488..26a7fe1).
Task 4: minor (deferred): enforce same-source parent variant lineage directly in SQLite; final whole-branch review must triage.
Task 4: minor (deferred): strengthen migration assertions for persisted evidence anchor/confidence and temporal values; final whole-branch review must triage.
Task 4: complete (commits 4114ef3..26a7fe1, review clean). Forced controller verification executed all 47 Gradle tasks successfully before initial review; fix-round verification reported 36 domain tests, 10 Android JVM tests, 12 contract tests, and instrumentation-test compilation green. Connected-device execution remains deferred by ruling.
Stopping checkpoint: user requested a clean Android-build handoff after Task 4 to conserve credits. Task 5 was interrupted before RED execution/production implementation; only two untracked test drafts existed and were moved into this plan's ignored recovery workspace under `task-5-partial/`. Resume Task 5 from its brief and restore/review those drafts rather than restarting completed Tasks 1-4.
Task 5: complete — commit 0e66c30 added encrypted SHA-256-addressed Source Vault, immutable source derivatives, encrypted temporary-session store, passphrase-authenticated archive import/export, local PHI/credential scanner/policy, and an Android Keystore key provider. Focused RED reached missing APIs; focused vault/scanner suite passed 13/13; Android unit-test module passed before the final Keystore-provider addition; `git diff --check` passed. Re-run `:platform:android:testDebugUnitTest` on an Android-SDK environment before release. Next task: Task 6 universal artifact ingestion.
Task 6: foundation checkpoint — added the resumable ingestion core (format detection, extractor ports, immutable checkpoint state, batch-context candidates, and PHI-review resume path) plus Android host/extractor adapters. Focused core ingestion tests passed. Android JVM compilation is deferred: this PC has no Android SDK (`sdk.dir`/`ANDROID_HOME` absent). Rich PDF/DOCX/XLSX layout and image OCR engines remain explicit adapter work for the Android build environment; do not mark Task 6 complete until their launch-format fixtures and Android tests pass.
Task 5: Android JVM verification passed: `:platform:android:testDebugUnitTest --tests '*SourceVaultTest' --tests '*SensitiveContentScannerTest'` — BUILD SUCCESSFUL.
Task 6: structured PDF extraction passed with real PDFBox Android page parsing and `PdfPageBox` anchors (commit d5d5d38).
Task 6: structured DOCX extraction passed with ZIP/WordprocessingML paragraph parsing and text-span anchors (commit fd09494).
Task 6: structured XLSX extraction passed with ZIP/XML workbook/sheet parsing and `SheetRange` anchors (commit 3d5a3aa).
Task 6: Android image OCR contract passed with a deterministic OCR engine; real ML Kit OCR passed on a connected Android device (commit 3fc6728).
Task 6: scanned-PDF OCR fallback passed with `PdfPageOcrEngine`; real Android `PdfRenderer` plus ML Kit scanned-PDF OCR passed on device (commits 5db79b6, bd5509d).
Task 6: durable checkpoint slice — Room persists only session/stage/allowed descriptor metadata and opaque temporary payload references; encrypted temporary-session storage holds pre-review artifact and extraction payloads. Restart test simulated process death after `EXTRACTED`, recreated Room/payload stores, resumed without repeat extraction, and confirmed neither extracted text nor bytes appear in the Room checkpoint table/database. Focused `:core:ingestion:test --tests '*IngestionPipelineTest'` and `:platform:android:testDebugUnitTest --tests '*RoomIngestionCheckpointStoreTest'` passed.
Task 6 WorkManager Slice 1: AndroidX WorkManager scheduling added with deterministic `kairo-ingestion-<sessionId>` unique work, `ExistingWorkPolicy.KEEP`, session-ID-only input, custom `KairoWorkerFactory`, and Android-owned `IngestionRuntimeFactory` seam. Focused `IngestionWorkSchedulerTest.enqueues one unique work item for a session` passed; commit 99c0ded.
Task 6 WorkManager Slice 2: focused worker-factory restart test persisted `EXTRACTED`, discarded the first Room/runtime instance, constructed `KairoIngestionWorker` through `KairoWorkerFactory`, created a fresh pipeline through `IngestionRuntimeFactory`, resumed to `COMPLETE`, and confirmed extraction count remained one. Focused test passed.
Task 6 WorkManager Slice 3: focused PHI-review worker test recreated the runtime from durable stores, returned non-retrying WorkManager success for `PHI_REVIEW_REQUIRED`, retained the Room checkpoint and encrypted temporary payload references, and did not repeat extraction. Focused test passed.
Task 6 launch-format/restart completion slice: added explicit CSV/TXT/Markdown/pasted-text/JPEG coverage, a restart-safe pasted-text media type, CSV used-range provenance, encrypted round-trip support for every `AnchorLocator` type, and `AndroidIngestionRuntimeFactory` composition using Room, no-backup encrypted temporary storage, Android Keystore, local scanning, and default Android extractors including scanned-PDF OCR. Focused WorkManager/checkpoint/payload/launch-format regression group passed.
Task 6 Sol milestone review: fixed terminal `COMPLETE` re-entry to remain idempotent after payload cleanup and to retry stale temporary cleanup; narrowed WorkManager retry to explicit transient failures; added unique-work cancellation; removed the modified-UTF size ceiling for extracted text; made specific extensions override generic text MIME; hardened DOCX/XLSX XML parsing against DOCTYPE/external entities; and updated the JVM migration gate through schema v3. Focused RED/GREEN regressions passed.
Task 6 COMPLETE: fresh `:core:ingestion:test :platform:android:testDebugUnitTest --rerun-tasks` executed all 43 tasks successfully. Previously passing connected-device ML Kit image OCR and Android `PdfRenderer` scanned-PDF OCR were not rerun because milestone changes did not affect those paths. Task 7 must not begin until explicitly requested.

### Task 7 - Memory Inbox core/persistence milestone

- Implemented controlled Memory Inbox promotion.
- AI candidates remain inactive until explicit human approval.
- Added approve, edit-and-approve, reject, and defer decision semantics.
- Edit-and-approve preserves original candidate text and promotes only reviewed text.
- Reject/defer preserve decision history without creating authoritative facts.
- Added restart-durable MemoryInboxStore abstraction.
- Added Room-backed Memory Inbox persistence with schema v4 and migration 3 -> 4.
- Persisted pending candidates, decisions, and source-anchor evidence.
- Verified pending/deferred/rejected state survives service/store recreation.
- Task 7 Android review UI is deferred to Task 11 because no Android app/composition module exists yet.
- Focused Task 7 gate passed:
  `./gradlew :core:application:test :platform:android:testDebugUnitTest --tests '*MemoryInbox*'`
