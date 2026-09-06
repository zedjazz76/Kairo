# SDD ledger — plan: docs/superpowers/plans/2026-08-20-kairo-v1-implementation.md

Workspace: C:/Users/rdunn/Documents/Codex/2026-08-20/referenced-chatgpt-conversation-this-is-an/.worktrees/kairo-v1
Branch: kairo-v1
Merge base: 84075ac
Remote: https://github.com/zedjazz76/Kairo.git

## Progress checkpoint — Live Deep Analyze activation (blocked external boundary)

2026-08-25 started from the clean Task 15 closure `80d4802` on `kairo-v1`.

Recovery and investigation:
- Authorized Android device `R5GYC4YHMNN` is connected.
- Safe environment inspection reported `OPENAI_API_KEY present: no`; no secret value was read or emitted.
- Android has deterministic `DeepAnalyzeService` and answer validation, but its composition root still installs an erroring cloud provider. The relay currently contains in-process `ModelGateway`/`OpenAIProvider` classes only: it has no runtime endpoint, deployed relay URL, or Android session-authorized channel for a live request.
- Official OpenAI documentation was checked before model selection. A future implementation must use the Responses API, keep `store: false`, and select a reasoning-capable model through relay environment configuration rather than a hard-coded Android/browser value.

Focused TDD completed before the boundary:
- Added a failing `DeepAnalyzeServiceTest` proving a relay/provider transport failure must preserve the deterministic diagnostic result.
- RED: the provider exception escaped `deepAnalyzeWithReasoning`.
- GREEN: `DeepAnalyzeService` now catches provider exceptions and returns the deterministic result with no enrichment; `./gradlew --no-daemon :core:application:test --tests '*DeepAnalyzeServiceTest'` passed.

Status: **BLOCKED**. Completing the requested live Android → relay → OpenAI path requires a running relay deployment with an explicit Android-session authentication mechanism and an `OPENAI_API_KEY` present only in that relay environment. No unauthenticated endpoint, static Android token, APK key, browser key, or direct Android-to-OpenAI fallback was introduced. Task 15 remains closed; Guardian UI Gold Pass has not started.

## Progress checkpoint — Local stateless relay direction

2026-08-25 resumed from `e636082` for the approved USB/ADB-reverse local relay direction.

- Recovery found no authorized ADB device and `OPENAI_API_KEY present: no`; no value was printed.
- The focused relay model test was RED because `OpenAIProvider` defaulted to a hard-coded model. It is GREEN after making `KAIRO_REASONING_MODEL` relay-environment configuration mandatory (with an injectable test override) and setting Responses API `store: false`.
- `pnpm --filter @kairo/relay test` — PASS (19/19). This change keeps credentials and model choice relay-only; it does not introduce a local endpoint, static Android secret, or direct Android→OpenAI path.
- Live local relay runtime, ADB reverse, Android adapter/device smoke, and the single live OpenAI request remain blocked until the USB device is authorized and a relay-only API key is supplied. Guardian UI Gold Pass remains unstarted.

## Progress checkpoint — Live Deep Analyze local activation

2026-08-25 resumed from `62dd5da` with the inherited relay environment
present and authorized device `R5GYC4YHMNN` connected.

- Added a loopback-only local relay runtime at `127.0.0.1:8787` with a
  bounded `/v1/deep-analyze` endpoint. It keeps no request/response state,
  binds only to host loopback, uses the relay-only OpenAI provider, and emits
  only safe failure class/code metadata (never prompt bodies or credentials).
- Responses requests remain `store: false` and now use strict JSON Schema
  output. Android debug builds access only `http://127.0.0.1:8787` through a
  localhost-only cleartext rule; release builds have no local relay URL.
- The Android adapter sends the current evidence packet only through that
  local relay, maps structured claims through the existing answer validator,
  and preserves the deterministic Deep Analyze result on every relay/provider
  failure. The manual instrumentation gate uses a non-PHI, evidence-free
  request and requires an explicit `kairo.live=true` runner argument.
- `pnpm --filter @kairo/relay test` — PASS (22/22), including bounded input,
  no retained request state, and safe upstream failure telemetry.
- `:apps:android:testDebugUnitTest` focused adapter/root coverage — PASS, and
  `:apps:android:assembleDebug` — PASS. Fresh debug APK installed on the
  authorized device; `adb reverse tcp:8787 tcp:8787` was verified.
- The physical Android gate reached the local relay and the relay reached the
  Responses API. The safe upstream result was
  `upstream_rate_or_quota_limited` / `billing_not_active`; no prompt or secret
  was printed. The live gate cannot pass until billing is activated for the
  configured API project. Guardian UI Gold Pass remains unstarted.

## Closure — Live Deep Analyze activation

2026-08-25 the funded relay environment and unlocked authorized device closed
the local Live Deep Analyze gate from `9d76eb2`.

- `OPENAI_API_KEY` and `KAIRO_REASONING_MODEL` were present in the inherited
  relay environment; their values were not read or printed. The relay ran only
  on `127.0.0.1:8787`, and `adb reverse tcp:8787 tcp:8787` was active for
  `R5GYC4YHMNN` (Samsung SM-S176V).
- The non-PHI local Responses smoke passed with a structured advisory and no
  production-write claim. The manual Android live gate
  `LiveDeepAnalyzeDeviceGateTest` passed on the same device through the
  production `LocalRelayReasoningProvider`.
- The unlocked Android gate passed all 11 requested UI/scope tests:
  `OfflineCapabilityTest`, `EvidenceNavigationTest`,
  `AndroidCopilotRetrievalProjectionTest`, and `KairoActivityDeepAnalyzeTest`.
  This covers Quick/local offline behavior, Deep Analyze UI composition,
  evidence navigation, and planned PROJECT, INCIDENT, and VERIFY boundaries.
- Fresh deterministic fallback coverage passed:
  `./gradlew --no-daemon --rerun-tasks :core:application:test --tests
  '*DeepAnalyzeServiceTest'`. A relay/provider failure preserves the local
  deterministic result without model enrichment.
- Focused security coverage passed: `pnpm --filter @kairo/relay test` (22/22)
  and `node --test validation/security/relay-retention.spec.ts` (1/1). The
  relay remains live-only and deletes routing state on disconnect.

Status: **COMPLETE — Live Deep Analyze is green on the authorized Android
device and ready to push. Guardian UI Gold Pass remains unstarted.**

## Progress checkpoint — Task 15 V1 Definition of Done and release closure

2026-08-25 Task 15 is complete. It closes the technical V1 Definition of Done
without beginning the Guardian UI Gold Pass.

Baseline and initial gate:
- Started from Task 14 closure `b88e7b8940d68f46ffa41e1d50b89d3f82d4b200` on `kairo-v1` with the original focused Memory Inbox test correction preserved.
- The first combined release invocation was RED because `pnpm` was unavailable on the local PATH. The local toolchain was restored through Corepack; no repository dependency or CI secret was added.
- The combined connected lifecycle did not provide useful completion output in this environment, so the release record uses the passing hosted `check` plus the exact targeted physical-device suites. This is an environment execution limitation, not a claimed hosted-device CI substitute.

Implemented and corrected:
- Added `validation:e2e` and `DefinitionOfDoneTest`, which exercises real ingestion and sensitive-content boundaries for a DOCX/PDF/image/XLSX capture batch.
- Added the human, evidence-backed `validation/e2e/kairo-v1-definition-of-done.md`, PHI boundary and live-relay-retention security specs, CI enforcement, reports placeholder, and concise V1 README release instructions.
- Strengthened the PHI release scan to cover API-key-like markers, private keys, and synthetic patient markers outside explicit synthetic fixture boundaries.
- The strengthened scan first failed on two runtime scanner tests containing synthetic API-key-shaped literals. The test fixtures now compose the same synthetic value at runtime, preserving scanner coverage while allowing the release scan to distinguish checked-in literal secrets from test data. RED: `node --test validation/security/phi-boundary.spec.ts`; GREEN: the same test and `:platform:android:testDebugUnitTest --tests '*SensitiveContentScannerTest'`.

Final verification:
- `./gradlew --no-daemon check` — PASS (1m 43s).
- `./gradlew --no-daemon :validation:e2e:test` — PASS (1 test).
- `pnpm test -r` — PASS (12 contracts; 2 Task 15 security tests).
- `KAIRO_PLAYWRIGHT_EXECUTABLE=/usr/bin/google-chrome pnpm --filter @kairo/desktop-web e2e` — PASS (1/1).
- `pnpm audit --prod` — PASS; no known vulnerabilities.
- `:platform:android:connectedDebugAndroidTest ... KnowledgeMigrationTest` — PASS (1/1) on Samsung SM-S176V.
- `:apps:android:connectedDebugAndroidTest ... KairoActivityTest, MemoryInboxApprovalTest, AndroidCopilotRetrievalProjectionTest` — PASS (8/8) on Samsung SM-S176V.
- Fresh debug APK build/install/launch completed before this final documentation-only / test-fixture correction. The correction changes neither production APK code nor persisted-device data.

Final authorized-device smoke on `R5GYC4YHMNN` / Samsung SM-S176V:
- The app launched through owner authentication and displayed the Offline mode boundary: local knowledge remains available while Deep reasoning is unavailable.
- The intended Genesis Memory Inbox action approved the staged curated batch and ended at `Inbox clear`.
- Copilot returned `Observed for mana: Merge / AMICAS PACS`.
- Planned/project separation held: Merge RIS → `Planned [PROJECT] ... AbbaDox CareFlow for non-breast imaging`; ViewPoint → `Planned [PROJECT] ... Rad AI direction`.
- Incident separation held: GSPS → `Observed [INCIDENT] ... Explicit VR Little Endian transfer syntax`.
- Unsupported endpoint behavior held: exact Altamont AE Title/port remained `[PROJECT]` and `requires verification`; no value was invented.
- Evidence navigation held: Projects → Open evidence reached Sources overview with `curated-mana-discovery` anchors and 100% confidence.

Security and release outcome:
- `git diff --check` and the final secret/PHI grep are clean; `.private` is ignored and no private Genesis payload is tracked.
- `122c2bc test: encode Kairo V1 definition of done`, `f062892 fix: make V1 PHI release scan Gradle-safe`, and `5ffb8ae fix: close Kairo V1 release secret scan` are the Task 15 implementation/recovery commits before the final documentation closure commit.
- Task 15 status: complete. Kairo V1 technical backend/Core is release-gated, including the required manual physical-device evidence. The next milestone is Guardian UI Gold Pass; it has not been started.

## Progress checkpoint — Task 14 Android retrieval correction and device closure

2026-08-25 Task 14 is complete. The final live gate ran on authorized device `R5GYC4YHMNN` / SM-S176V using a freshly built and installed debug APK after a clean Kairo app-local data reset and owner authentication.

Defect and root cause:
- The private benchmark exercised a fake repository that returned all approved facts directly to `HybridRetriever`. Android instead composed Copilot from `RoomKnowledgeRepository.currentUnderstanding(...)`.
- That existing current-production projection deliberately retained only current `CONFIRMED`/`OBSERVED` facts and grouped them by `(subject, predicate)`. It therefore hid `PLANNED`, `VERIFY`, and incident evidence from Copilot, and could collapse independent MANA `USES` facts such as PACS and RIS.

Bounded correction:
- Added `KnowledgeRepository.retrievalUnderstanding(...)` and the Room implementation's retrieval-specific projection. It reads the same fact history and preserves independent facts, temporal applicability, `KnowledgeScope`, `EvidenceState`, project/incident context, and `EvidenceRef` provenance; it includes durable `CONFIRMED`, `OBSERVED`, `PLANNED`, `VERIFY`, and `HYPOTHESIS` facts without a schema/database migration or a second store.
- Kept `currentUnderstanding(...)` and its current-production UI projection unchanged. Android uses the retrieval projection only for Copilot reasoning; Systems/Projects/Knowledge/Sources continue to use the current-production view.
- Quick-answer composition now renders non-production scope explicitly (for example `Planned [PROJECT]` and `Observed [INCIDENT]`) without promoting those facts to current MANA production truth.
- Preserved the required focused `MemoryInboxApprovalTest.kt` correction, which constructs the real inbox service for the passing Genesis UI path.

TDD and verification:
- Added `AndroidCopilotRetrievalProjectionTest`, a real Room database → `KairoCompositionRoot` → Copilot instrumentation regression suite. It covers independent MANA PACS/RIS facts, planned PROJECT AbbaDox and ViewPoint direction, VERIFY endpoint behavior, and INCIDENT GSPS evidence.
- The new scope assertions were first run RED (4 expected assertion failures) and then GREEN (5/5 on SM-S176V).
- `./gradlew --no-daemon --rerun-tasks :core:domain:test :core:ingestion:test :core:application:test :core:retrieval:test :platform:android:testDebugUnitTest :apps:android:testDebugUnitTest` — PASS.
- `./gradlew --no-daemon :core:domain:test :core:ingestion:test :core:application:test :core:retrieval:test :platform:android:testDebugUnitTest :apps:android:testDebugUnitTest :apps:android:assembleDebug` — PASS.
- `./gradlew --no-daemon :core:application:test --tests 'kairo.application.GenesisPrivateBenchmarkTest'` — PASS; all 14 private benchmark cases remain green.
- `./gradlew --no-daemon :apps:android:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=kairo.android.app.AndroidCopilotRetrievalProjectionTest` — PASS (5/5). Earlier targeted `KairoActivityTest`, `MemoryInboxApprovalTest`, and retrieval tests passed 8/8 before the final scope-label-only composition correction.

Final on-device gate:
- Memory Inbox staged and approved the 41 local curated Genesis statements through the intended UI; the screen reported `Inbox clear`.
- Offline/local smoke PASS: the home screen states that local knowledge remains available while deep reasoning is unavailable; the listed Copilot answers were returned on that device-local path.
- PACS resolves to `Merge / AMICAS PACS`; PACS monitoring resolves to `AMICAS Watch`; DMWL is returned for `merge amicas pacs`.
- Current breast imaging resolves to `Merge RIS`; breast dictation resolves to `Dragon One` when asked about PowerScribe.
- AbbaDox returns `Planned [PROJECT] for merge ris: AbbaDox CareFlow for non-breast imaging`; ViewPoint returns `Planned [PROJECT] ... Rad AI direction`.
- The broad Baxter project wording remains unknown rather than promoted into MANA production truth.
- The GSPS forwarding question returns incident-scoped evidence (`Observed [INCIDENT] ... Explicit VR Little Endian transfer syntax ...`).
- The exact Altamont AE Title/port remains explicitly PROJECT-scoped `requires verification`; no endpoint, AE Title, or port was invented.
- Evidence navigation PASS: `Open evidence` routes to Sources and displays `curated-mana-discovery` with local source anchors and confidence.

Task 14 status: closed. Task 15 remains unstarted and is ready to begin only as the next separately authorized task.

## Progress checkpoint — Task 14 Genesis load and first real APK

2026-08-24 Task 14 has a local private-curated Genesis seed wired into the single Android-hosted Core for debug builds. The ignored seed remains untracked and is copied into the debug APK only when it exists locally; its checked-in manifest has the real content hash and no corpus payload.

Implemented / corrected:
- A 41-statement curated seed is decoded into structured, source-anchored Memory Inbox candidates. Every activation still requires explicit local Memory Inbox approval; the bootstrap has no repository/fact-promotion shortcut.
- The Android session stages the local package after Core load and exposes a single explicit “Approve curated Genesis knowledge” action. Non-asset test sessions keep Genesis unavailable rather than creating a second store or relaxing review semantics.
- The private benchmark now consumes all 14 checked-in question/expectation cases after approval. It verifies evidence linkage, required scope/state boundaries, product-versus-MANA separation, project/incident semantics, planned/VERIFY treatment, and qualified unknown behavior.
- Fixed two integration defects exposed by the final gates: root source and root variant now share the same import timestamp; the JVM version-1 migration fixture registers the authoritative 1→7 migration chain.

Fresh verification:
- `./gradlew --no-daemon :core:application:test --tests 'kairo.application.GenesisPrivateBenchmarkTest'` — PASS (the private benchmark executes all 14 cases).
- `./gradlew --no-daemon --rerun-tasks :core:ingestion:test :core:application:test :core:retrieval:test :apps:android:testDebugUnitTest :platform:android:testDebugUnitTest` initially exposed the stale JVM migration fixture; core ingestion/application/retrieval passed before that failure.
- `./gradlew --no-daemon :platform:android:testDebugUnitTest --tests 'kairo.platform.db.KnowledgeMigrationJvmTest' --rerun-tasks` — PASS after aligning the 1→7 fixture.
- `./gradlew --no-daemon --rerun-tasks :apps:android:testDebugUnitTest :platform:android:testDebugUnitTest` — PASS.
- `./gradlew --no-daemon :platform:android:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=kairo.platform.db.KnowledgeMigrationTest` — PASS (1 test) on `R5GYC4YHMNN` / SM-S176V.
- `./gradlew --no-daemon :core:ingestion:test --tests 'kairo.ingestion.GenesisImporterTest'` — PASS after the source-identity correction.
- `./gradlew --no-daemon :apps:android:clean :apps:android:assembleDebug` — PASS; fresh APK: `apps/android/build/outputs/apk/debug/android-debug.apk`.
- The fresh APK was installed with `adb install -r` and `KairoActivity` was launched; its process and resumed activity were confirmed on `R5GYC4YHMNN`.

Device boundary:
- The connected phone is currently at the system PIN screen. The app remains running but Android hides its window behind that lock, which makes Compose hierarchy tests and manual on-screen question verification unavailable. No credential was entered or bypassed. After the owner unlocks the phone, rerun the targeted KairoActivity/Memory Inbox instrumentation tests and ask the benchmark MANA questions in the app before claiming the device UI gate complete.

Task 14 status: implementation, private benchmark, migration, source provenance, and fresh APK build are complete. Final on-screen device retrieval verification is pending the user unlocking the connected device. Task 15 remains unstarted.

## Progress checkpoint — Task 14 Genesis corpus import and private benchmark

2026-08-24 Task 14 implementation is complete; literal private-corpus execution is **BLOCKED** pending the approved private Genesis source payloads.

Implemented:
- `validation/corpus/manifest.schema.json` and strict Kotlin manifest loading for stable identities, safe logical references, SHA-256 hashes, source type/classification, categorical authority, intended scope/state, temporal disposition, sensitivity disposition, domains, and project tags.
- `GenesisImporter` composes the existing `IngestionPipeline` with Source and Memory Inbox candidate ports. It verifies payload hashes, preserves source authority/provenance and anchors, routes sensitive findings to the existing PHI review boundary, and has no fact/repository promotion shortcut.
- `MemoryCandidateDraft` now carries backward-compatible `proposedScope`/`proposedState` defaults (`MANA_PRODUCTION`/`OBSERVED`); `MemoryInboxService.approve` and edit-and-approve append those reviewed values exactly. Raw conversation sources are rejected if they propose `CONFIRMED` and remain `PROPOSED` candidates.
- Room v5/v6 migrations persist candidate proposal metadata and source authority; legacy rows safely receive the old defaults / `UNSPECIFIED` authority.
- The checked-in Genesis manifest is deliberately `AWAITING_PRIVATE_SOURCES` with all required domains listed and zero entries. No private payload, hash, MANA document, screenshot, or fabricated fact is committed.
- Versioned benchmark questions/expectations cover current-vs-planned breast architecture, AbbaDox migration, PACS/DMWL evidence, product-versus-MANA boundaries, Baxter project scope, and qualified unknown behavior. A synthetic test fixture exercises the existing `HybridRetriever`; it is explicitly not a substitute for the private benchmark corpus.

Fresh verification:
- `./gradlew --no-daemon :core:ingestion:test --tests '*GenesisImporterTest'` — PASS.
- `./gradlew --no-daemon :core:application:test --tests '*MemoryInboxServiceTest'` — PASS.
- `./gradlew --no-daemon :core:retrieval:test --tests '*GenesisBenchmarkEvaluationTest'` — PASS.
- `./gradlew --no-daemon :platform:android:testDebugUnitTest --tests '*RoomMemoryInboxStoreTest' --tests '*MemoryInboxMigrationJvmTest' --tests '*RoomKnowledgeRepositoryTest'` — PASS.
- `./gradlew --no-daemon :core:ingestion:test :core:retrieval:test` — PASS.
- `adb devices` found `R5GYC4YHMNN`; `./gradlew --no-daemon :platform:android:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=kairo.platform.db.KnowledgeMigrationTest` — PASS on SM-S176V.

Commits:
- `36b2585 feat: add review-gated Genesis importer`
- `348d8d0 data: define Genesis corpus benchmark boundary`
- `7cf4fd1 test: cover Genesis metadata migration on device`

Remaining external blocker: approved private Genesis source payloads are absent locally. Populate ignored/private source material, compute real SHA-256 values, change the manifest to `READY`, and execute the private benchmark before claiming Task 14 fully complete.

Known debt: the focused and grouped Gradle runs continue to emit pre-existing deprecated/obsolete AGP variant API and Kotlin/AGP setting warnings. Task 14 did not change those build settings.

Next task: Task 15 is not started. It is ready only after the private-corpus execution blocker is resolved (or Robert explicitly narrows the release gate).

## Progress checkpoint — Task 13 browser host, E2E gate, and closure

2026-08-24 Task 13 is complete for the approved browser-desktop scope.

Implemented:
- Vite browser host (`index.html`, `main.tsx`, and `DesktopBrowserApp`) with React-owned rerender boundaries around the existing ephemeral workspace and metadata-only CaptureBatch state.
- Desktop navigation for Capture, Memory, and Projects; Copilot remains visible while evidence is opened.
- Playwright desktop E2E coverage for ordered multi-file staging, Analyze together, Deep Analyze, evidence opening beside Copilot, and Memory navigation.
- The E2E seam substitutes only the external paired-command sender and records command types; it contains no fake Core database and retains no command/file plaintext.
- `pnpm-workspace.yaml` now uses pnpm 11's current `allowBuilds` map (`esbuild: true`). This replaces the obsolete `onlyBuiltDependencies` setting that pnpm 11 reported as ignored; no obsolete `package.json` pnpm build-policy field was introduced.
- `@playwright/test` is a desktop dev dependency. The local test runner may set `KAIRO_PLAYWRIGHT_EXECUTABLE` for an already-installed browser; no machine path is committed and CI/default environments use Playwright provisioning.

Fresh verification:
- `npx --yes pnpm@11.19.0 install --frozen-lockfile` — PASS.
- `npx --yes pnpm@11.19.0 --filter @kairo/desktop-web test` — PASS (16 tests).
- `npx --yes pnpm@11.19.0 --filter @kairo/desktop-web build` — PASS.
- `npx --yes pnpm@11.19.0 test` — PASS (12 shared-contract tests).
- `npx --yes pnpm@11.19.0 --filter @kairo/relay test` — PASS (18 relay tests).
- `KAIRO_PLAYWRIGHT_EXECUTABLE=/usr/bin/google-chrome npx --yes pnpm@11.19.0 --filter @kairo/desktop-web e2e` — PASS (1 browser E2E test).

Task 13 closure decision: Android verification was not rerun because this Task 13 work changed neither shared contracts nor Android/tunnel implementation. Pairing UX was intentionally not added because the approved Task 13 plan does not specify it; the composed desktop command boundary remains fail-closed until a paired client is provided.

Next major architectural boundary: Task 14 — controlled Genesis Corpus import and private benchmark.

## Progress checkpoint — Task 13 paired desktop command composition

2026-08-24 Task 13 paired command composition completed with focused desktop verification.

Implemented:
- `composePairedDesktopCommands(...)` is the desktop application boundary around `PairedTunnelClient`; it exposes one typed `CoreCommandV1` sender and explicit `UNPAIRED`, `CONNECTED`, `DISCONNECTED`, and `EXPIRED` state.
- Every desktop action uses that same sender when composed: CaptureSource, AskKairo, DeepAnalyze, ReviewMemoryCandidate, GetProject, and OpenEvidence. OpenEvidence sends before changing the workspace selection.
- The composition fails closed for unpaired and expired sessions and disconnects its application state after a send failure.
- `CaptureBatch` now creates stable UUID request IDs at staging time, preserving ordered metadata-only CaptureSource dispatch while complying with the Core schema.
- Memory and Projects are present in the app shell when their workspace is active; they receive the same injected sender without browser persistence or direct relay calls.

Focused verification:
`apps/desktop-web/node_modules/.bin/tsx --tsconfig apps/desktop-web/tsconfig.json --test apps/desktop-web/src/app/AppCommandComposition.test.tsx apps/desktop-web/src/app/App.test.tsx apps/desktop-web/src/app/EvidenceAction.test.tsx apps/desktop-web/src/app/PairedDesktopCommands.test.ts apps/desktop-web/src/features/capture/CaptureBatch.test.ts apps/desktop-web/src/features/capture/CaptureAnalyze.test.tsx apps/desktop-web/src/features/capture/CaptureDrop.test.tsx apps/desktop-web/src/features/copilot/CopilotAsk.test.tsx apps/desktop-web/src/features/copilot/CopilotDeepAnalyze.test.tsx apps/desktop-web/src/features/memory/MemoryInbox.test.tsx apps/desktop-web/src/features/projects/ProjectsWorkspace.test.tsx`

Result: PASS in focused subsets before checkpoint; the command composition integration proves all six Task 13 command types decrypt to their original typed envelopes only at the Core test endpoint and are absent from routed ciphertext.

Next: add the Vite browser host and minimum Playwright E2E workflow. Pairing UX remains out of scope because the approved Task 13 plan does not call for it.

## Progress checkpoint — Task 13 evidence metadata inspection

2026-08-24 Task 13 evidence inspection completed with focused desktop verification.

Implemented:
- `EvidencePane` resolves an injected, transient evidence-inspection record by the exact active `evidenceRef`.
- The pane makes provenance visible: source name and ID, source/media type, origin, classification, import timestamp, content hash, and already-resolved anchor description.
- `App` passes injected records only to the active evidence pane. The browser creates no evidence store, retains no source contents, and does not fetch source files directly.

Focused verification:
`apps/desktop-web/node_modules/.bin/tsx --tsconfig apps/desktop-web/tsconfig.json --test apps/desktop-web/src/features/evidence/EvidencePane.test.tsx apps/desktop-web/src/app/App.test.tsx apps/desktop-web/src/app/EvidenceAction.test.tsx`

Result: PASS (5 tests, 0 failures).

Architectural decision: the current shared `OpenEvidence` result carries only an `evidenceRef`; metadata remains resolver-injected at the desktop boundary for this slice rather than inventing a new wire contract or browser persistence layer.

Next: compose the existing injected desktop command path through `PairedTunnelClient`, then add the browser E2E host/gate.

## Progress checkpoint — Task 13 desktop capture/Copilot/evidence shell

2026-08-23 Task 13 desktop-web capture/Copilot/evidence work recorded after focused local verification reported PASS.

User-reported focused verification completed for:
- `DesktopWorkspace.test.ts`
- `CaptureBatch.test.ts`
- `App.test.tsx`
- `EvidenceAction.test.tsx`
- `CaptureAnalyze.test.tsx`
- `CopilotAsk.test.tsx`
- `deep-analyze-contract.test.ts`
- `generated-types.test.ts`
- `CopilotDeepAnalyze.test.tsx`
- `CaptureDrop.test.tsx`
- `MemoryInbox.test.tsx`

Task 13 implemented so far:
- `DesktopWorkspace` is the single browser workspace state spine with approved destinations: Capture, Copilot, Memory, and Projects.
- Capture is the initial workspace; Copilot remains visible while evidence is reviewed.
- `CaptureBatch` stages ordered source metadata only, retains no raw file bytes in the batch model, and deterministically emits typed `CaptureSource` `CoreCommandV1` envelopes.
- Desktop React/Vite/TypeScript foundation is present with automatic `react-jsx` runtime configuration.
- `App.tsx` renders the first browser split-view shell using `CaptureWorkspace`, `CopilotWorkspace`, and `EvidencePane`.
- Copilot exposes an `Open evidence` action wired through the existing `DesktopWorkspace.openEvidence(...)`; opening evidence preserves Copilot and displays the matching evidence reference.
- `CaptureWorkspace` exposes `Analyze together`, consumes the existing ordered `CaptureBatch.commands()`, and dispatches staged `CaptureSource` commands sequentially through an injected async Core-command sender.
- `CaptureWorkspace` accepts browser-selected files through a multiple-file input, preserves browser selection order, converts each file to metadata-only staged state through a caller-supplied source-reference function, renders staged filenames immediately, and does not retain raw file contents in `CaptureBatch`.
- `CopilotWorkspace` renders a real Ask Kairo form and dispatches one typed `AskKairo` `CoreCommandV1` using an injected async Core-command sender and caller-supplied request ID.
- The Core contract defines a dedicated `DeepAnalyze` command and success-result branch, with generated TypeScript declarations synchronized from the source schema.
- `CopilotWorkspace` exposes a distinct `Deep Analyze` action that reuses the current question field and dispatches a typed `DeepAnalyze` `CoreCommandV1` through the same injected sender without changing the existing Ask Kairo or Open evidence paths.
- `MemoryInbox` renders injected memory candidates and dispatches an exact typed `ReviewMemoryCandidate` command for the selected candidate through an injected sender, with no browser persistence or direct tunnel dependency introduced.
- The capture, Copilot, and Memory Inbox slices do not introduce a second browser state store, persist raw file bytes, or couple UI components directly to a concrete tunnel implementation.
- pnpm workspace build policy explicitly permits the Vite/esbuild install script so the no-install browser development/test harness is reproducible without interactive approval.

Task 13 status: shell, evidence-navigation, ordered capture-command dispatch, real browser capture/drop staging, Ask Kairo dispatch, Deep Analyze contract/UI dispatch, and Memory Inbox review dispatch are complete. Remaining Task 13 work includes Projects, richer source/evidence inspection behavior, paired-tunnel composition, and the planned browser E2E gate.

Next design gate: choose the next bounded Task 13 interaction slice before implementation.

## Progress checkpoint — Task 12 secure browser-to-Core tunnel

2026-08-23 Task 12 secure browser-to-Core pairing and stateless relay tunnel recorded complete after the user reported the grouped local verification gate passed.

User-reported grouped verification commands:
`npx --yes pnpm@11.19.0 --filter @kairo/relay test`
`npx --yes pnpm@11.19.0 --filter @kairo/desktop-web test`
`./gradlew :apps:android:testDebugUnitTest`

Reported result: PASS for all three commands. The assistant cannot independently execute the user's local Android/Node toolchain from GitHub, so this ledger records the grouped gate as user-reported local verification rather than independently reproduced verification.

Task 12 implemented surface:
- Relay `PairingService` with short-lived six-digit pairing codes, explicit Core-device confirmation, same-device cancellation, expiry, one-time consumption, and consumed/cancelled fail-closed behavior.
- Confirmed pairing is bound exactly once to a relay tunnel session; the tunnel session cannot outlive the pairing expiry.
- Relay `TunnelBroker` routes opaque encrypted frames only, rejects expired sessions/frames and replayed/non-monotonic sequence numbers, and removes live routing state immediately on disconnect.
- Bounded encrypted payload chunking and deterministic out-of-order reassembly with missing, duplicate, and mismatched chunk-set rejection.
- Browser Web Crypto-compatible P-256 ECDH, HKDF-SHA-256 session derivation using the `kairo-v1-paired-tunnel` context, AES-256-GCM frames, 96-bit random nonces, and authenticated session/sequence/expiry metadata.
- Browser and Android use the same portable uncompressed P-256 public-key encoding: `0x04 || X(32 bytes) || Y(32 bytes)`.
- Browser `PairedTunnelClient` encrypts before transport, emits monotonic sequence numbers, enforces local expiry/disconnect state, and sends generated `CoreCommandV1` envelopes through the encrypted path.
- Android `CoreTunnelClient` provides the transport-agnostic Core-side session boundary with fail-closed disconnected/session-mismatch behavior.
- Android `AndroidTunnelCrypto` implements matching P-256 ECDH, HKDF-SHA-256, AES-256-GCM, authenticated frame metadata, portable public-key import/export, and tamper rejection.
- Relay model-gateway legacy tests were aligned with the package's direct TypeScript `node --test` runner so the package-wide Task 12 verification gate can execute cleanly.
- `ADR-0002-desktop-tunnel-cryptography.md` records the algorithm suite, pairing/session lifecycle, relay-retention boundary, threat model, rotation/expiry, disconnect cleanup, and recovery behavior.

Task 12 status: implementation and grouped local verification are reported complete.

Next planned task: Task 13 — browser desktop capture, Copilot, and evidence review.

## Prior checkpoint — Task 11 Android UI

2026-08-23 Task 11 Android UI full-gate completion candidate recorded after the user reported a successful local run on SM-S176V.

User-reported full verification command:
`./gradlew :apps:android:testDebugUnitTest :apps:android:connectedDebugAndroidTest`

Reported result: PASS. The assistant cannot independently execute the connected-device suite from GitHub, so this ledger records the result as user-reported local verification rather than independently reproduced verification.

Task 11 implemented surface:
- Premium dark Android shell with Copilot, Systems, Workflows, Projects, Knowledge, Capture, Sources, Memory Inbox, Quick, Deep Analyze, and offline capability boundaries.
- Knowledge renders approved `FactVersion` values and evidence states from the authoritative `knowledgeFacts` list.
- Systems, Workflows, and Projects render from the same authoritative approved knowledge model; no parallel stores were introduced.
- Sources renders current `EvidenceRef` entries, and facts can navigate through `Open evidence` to the matching source anchor.
- `KairoActivity` wires live session knowledge/evidence state into the production shell and refreshes after capture/approval flows.
- Capture retains the structured fact contract and now gates likely-PHI continuation through the existing Core `UserSensitiveChoice` values: `REDACT`, `TEMPORARY_USE`, and `CANCEL`.
- Memory Inbox approval refreshes authoritative knowledge and Copilot without restart.
- Copilot now preserves structured `KairoAnswer` data end-to-end and renders Assessment, Current MANA Understanding, Next action, and qualitative Confidence when present.
- Offline mode keeps local capabilities available and disables cloud-dependent Deep Analyze.
- Platform authentication uses Android `BiometricPrompt` with strong biometric or device credential.
- Background relock timing is isolated in the deterministic `RelockTimer`; shell relock behavior is covered separately, replacing the brittle full-Activity lifecycle instrumentation duplicate.
- Existing capture, persistence, memory approval, and end-to-end query flows were reconciled with the structured-answer contract during full-suite regression repair.

Task 11 status: implementation and local full-gate verification are reported complete. Independent connected-device reproduction is not available through the GitHub connector.

## Historical ledger

## Guardian UI Gold Pass closure — 2026-08-25

- Baseline: `b1732373a00d68fad829d0f72f04e691503300d5` (`feat: match Android shell to Guardian layout board`).
- Authoritative sources retained: `docs/branding/kairo-guardian-ui-layout-board.png` for composition and `docs/branding/kairo-guardian-brand-identity-board.png` for Guardian materials, artwork, palette, and wordmark.
- Final Android shell verification: Samsung SM-S176V (`R5GYC4YHMNN`) captured safe Home, Trace, and Knowledge screenshots in ignored `.private/guardian-ui/`; fixed bottom navigation remains above system navigation. Trace retains its dedicated ordered evidence timeline and Knowledge retains search/filter/empty-state behavior without fabricated facts.
- Focused connected Android instrumentation: PASS, 11 tests covering Guardian identity, custom bottom navigation, Trace Workflow, Knowledge, Memory Inbox approval, Evidence navigation, online/offline Deep Analyze behavior, and KairoActivity Deep Analyze wiring.
- Grouped Android/Core regression: PASS — `:apps:android:testDebugUnitTest`, `:platform:android:testDebugUnitTest`, `:core:application:test`, and `:core:retrieval:test`.
- Desktop unit regression: PASS, 16 tests. Playwright E2E remains environment-blocked: the required Chromium headless-shell executable was absent and the in-scope `playwright install chromium` download stalled without output; no product test failure was observed.
- Security: PASS — PHI boundary and relay-retention Node suites, production dependency audit, `git diff --check`, and repository secret scan (excluding ignored private artifacts).
- Final APK: `apps/android/build/outputs/apk/debug/android-debug.apk`; fresh build and Samsung install PASS. Ignored convenience copy: `.private/releases/Kairo-Guardian-Gold.apk`.
- Remaining non-blocking debt: rerun the single desktop Playwright workflow once the local Playwright Chromium runtime is available. Guardian UI Gold Pass closure is otherwise ready for documentation commit/push.

The prior Task 1–10 work history remains in repository history; this checkpoint records the final Task 11 and Task 12 implementation states and the current Task 13 progress.

## Progress checkpoint — Conversational continuity evidence foundation

2026-08-30 began the newly locked Kairo Conversational Continuity priority from
`fb3ef89280e6c7236379912ba24faba17dd95ccb` on `kairo-v1`.

Implemented the first Core-only slice:
- Added typed non-authoritative evidence-memory records for conversation turns and upload excerpts.
- Hybrid retrieval now returns related conversation/upload excerpts for differently worded queries while leaving `rankedClaims` empty when no fact has passed Memory Inbox review.
- Added `ConversationContinuityService` and its store boundary so chat and upload evidence can be captured automatically and reconstructed by a durable adapter without promoting it to authoritative knowledge.
- Inspected the finished Sites-hosted Kairo website. Its dashboard, projects/work views, source library, global search, owner intake, and Guardian presentation are candidates for the desktop experience; its independent D1/R2 knowledge tables must not become a second authoritative Kairo brain.

Focused TDD verification:
- RED: the retrieval test failed to compile because evidence-memory types/inputs did not exist.
- GREEN: `:core:retrieval:test --tests "*HybridRetrieverTest.related conversation and upload evidence are retrieved without becoming facts"` — PASS.
- RED: the continuity-service test failed to compile because the service/store did not exist.
- GREEN: `:core:application:test --tests "*ConversationContinuityServiceTest*"` — PASS.
- Combined focused gate for both tests — PASS.

Environment boundary:
- The Room persistence test target cannot run on this host because no Android SDK is installed or configured. No unverified Room migration or Android wiring was added in this checkpoint.

Next:
- Add the Room evidence-memory adapter and schema migration with a runnable Android test environment.
- Wire automatic user/assistant turn capture and ingestion excerpts into that store.
- Feed stored evidence into Android and desktop Core composition, then port the finished website experience onto those Core commands without retaining its parallel knowledge store.

## Progress checkpoint — Conversational continuity durable loop and website workspace merge

2026-08-30 completed the smallest end-to-end Kairo Conversational Continuity slice and merged the finished website's workspace experience into the existing desktop Core-command shell.

Implemented:
- Room database v8 persists non-authoritative conversation turns and safe upload excerpts with source, conversation, turn, kind, and capture-time provenance. Both production database builders carry the complete v1-to-v8 migration chain.
- Android Copilot automatically records each user and assistant turn in a shared conversation session; reopening the composition reconstructs persisted evidence into retrieval.
- Successful ingestion automatically records only durable, non-sensitive extracted artifacts. Temporary-use content and unredacted sensitive content are excluded from durable evidence memory.
- When no promoted fact answers a question, Ask Kairo may return related prior conversation/upload evidence with an explicit `not an approved MANA fact` boundary and no authoritative claims.
- A real close/reopen Room acceptance test records a troubleshooting conversation and upload, closes the database, opens a new composition, asks with different wording, retrieves and cross-references both sources, and confirms that no fact was promoted.
- The desktop shell now carries the finished website's Guardian dashboard and navigation model: Home, Knowledge, Projects, Work, Sources, Intake, Search, Memory Inbox, and persistent Copilot. Global search dispatches the typed `SearchKnowledge` Core command and renders grouped Core-provided results; Sources preserves provenance and the evidence-not-instructions boundary.
- The website's independent D1/R2 knowledge implementation was intentionally not copied. Kairo Core and its evidence/promotion rules remain the sole knowledge authority.

Focused TDD and verification:
- `:core:retrieval:test :core:application:test :core:ingestion:test :apps:android:testDebugUnitTest` — PASS.
- `:platform:android:testDebugUnitTest --tests "*KnowledgeMigrationJvmTest*" --tests "*MemoryInboxMigrationJvmTest*" --tests "*RoomKnowledgeRepositoryTest*"` — PASS, including the named-database close/reopen continuity acceptance test.
- `apps/desktop-web npm test` — PASS (30 tests).
- `apps/desktop-web npm run build` — PASS (43 transformed modules).
- In-app browser inspection at desktop width confirmed the Guardian dashboard, persistent Copilot, Search, Sources, responsive layout, and no browser console errors.

Verification note:
- The unrestricted platform-wide Robolectric command also reached an unrelated pre-existing ingestion-checkpoint test whose generated Windows database path exceeds SQLite's path handling limit. The affected migration, repository, and close/reopen suites pass through the short-path test workspace.

Next bounded desktop integration:
- Hydrate live Core response payloads into the Search, dashboard, work, knowledge, and sources props over the paired tunnel. The present desktop slice sends typed commands through the authoritative boundary and renders host-supplied Core results; it does not introduce browser persistence or a second knowledge store.

## Progress checkpoint — Encrypted desktop Core results and live Search hydration

2026-08-30 completed the first typed result-return slice for the paired desktop client.

Implemented:
- `PairedTunnelClient` can perform an encrypted request/result exchange on the existing session, decrypting only a response with the expected session, expiry, and monotonic inbound sequence.
- The relay tracks browser-to-Core and Core-to-browser replay sequences independently, so command sequence 1 and result sequence 1 are both valid while same-direction replays still fail closed.
- `DesktopCommandSender.request(...)` parses and validates `CoreResultV1`, requires matching request ID and command type, and disconnects on malformed or mismatched results.
- Search now publishes live `SearchKnowledge` result references returned through that paired request boundary, stores them in the single `DesktopWorkspace` state spine, and preserves them across navigation/rerender.
- Because the v1 search result contract currently carries references only, the browser displays the authoritative reference IDs and classifies recognized prefixes. It does not invent titles, summaries, or facts.

Focused TDD and verification:
- RED: encrypted request test failed because `requestPlaintext` did not exist; GREEN: paired tunnel client tests passed.
- RED: paired command result test failed because `DesktopCommandSender.request` did not exist; GREEN: correlated result and fail-closed mismatch tests passed.
- RED: Search result publication test returned no results; GREEN: Search and workspace persistence tests passed.
- RED: relay rejected result sequence 1 as a replay of command sequence 1; GREEN: directional replay suite passed.
- `apps/desktop-web npm test` — PASS (38 tests).
- `apps/desktop-web npm run build` — PASS (43 transformed modules).
- Relay pairing/tunnel focused gate — PASS (11 tests).
- Strict `tsc --noEmit` remains non-green only on the recorded baseline Node test typings, React test-element typing, and Web Crypto `BufferSource` typing; no new production-file errors from this slice remain.

Boundary retained:
- A deployed browser host transport must implement the new encrypted `request(frame)` exchange and Android Core must dispatch commands into `CoreResultV1`. The browser response boundary is production-ready and covered, but this checkpoint does not claim that the default unpaired browser bootstrap is a live Android session.

Next:
- Add the concrete paired host transport and Android Core command dispatcher for `SearchKnowledge`, then use the same validated result path for Copilot and the remaining dashboard collections.

## Progress checkpoint — Concrete paired SearchKnowledge transport and Android dispatch

2026-09-01 completed the next bounded encrypted desktop-to-Core result slice after
`a8c26ac`.

Implemented:
- Added a transient relay exchange that correlates one opaque browser command with one opaque Core result, maintains independent directional replay checks, times out bounded pending work, and removes command/result state after completion or disconnect.
- Added loopback relay HTTP routes for browser requests, Android command polling, correlated Android responses, and session disconnect. The relay validates only frame metadata and never receives the session key or plaintext.
- Added the concrete browser `RelayTunnelFrameTransport`, which implements the existing encrypted request/response transport boundary without adding browser persistence.
- Added the Android `SearchKnowledgeCoreCommandDispatcher`. It validates the exact v1 command envelope, retrieves relevant promoted facts and non-authoritative conversation/upload evidence through `HybridRetriever`, and returns a correlated `CoreResultV1` with reference IDs only. Empty retrieval returns `NOT_FOUND`; it does not fabricate search content or promote evidence memory.
- Added `EncryptedCoreRequestProcessor` to enforce the paired session, expiry, monotonic inbound sequence, authenticated decryption, independent outbound sequence, and encrypted result return.
- Wired the dispatcher into `KairoCompositionRoot`, so repository-reconstructed conversation/upload evidence and authoritative facts feed the same Android Core command boundary.
- Kept the OpenAI relay transport lazy-loaded so tunnel-only integration tests and hosts do not require the optional model-provider package at module load time.

Focused TDD and verification:
- RED: relay exchange test failed because `TunnelExchangeBroker` did not exist; GREEN: opaque correlated exchange test passed.
- RED: loopback relay integration returned `404`; GREEN: encrypted request/poll/response integration passed and retained no completed frames.
- RED: browser transport test failed because `RelayTunnelFrameTransport` did not exist; GREEN: concrete request and disconnect paths passed.
- RED: Android encrypted continuity test failed because the request processor and dispatcher did not exist; GREEN: differently worded `SearchKnowledge` returned both prior conversation and upload references through an encrypted result.
- RED: composition test failed because Android Core did not expose the dispatcher; GREEN: production composition wiring passed.
- `apps/desktop-web npm test` — PASS (39 tests).
- `apps/desktop-web npm run build` — PASS (43 transformed modules).
- Relay pairing/tunnel/runtime focused gate — PASS (12 tests).
- `:apps:android:testDebugUnitTest` — PASS with Android SDK 36.

Boundary retained:
- Pairing confirmation/session-key acquisition and the Android background poll/post lifecycle remain host-bootstrap work. This checkpoint provides their concrete encrypted HTTP transport, transient relay exchange, Android processing boundary, and production dispatcher without claiming the default unpaired desktop bootstrap is already a live paired session.

Next:
- Wire the existing pairing confirmation into the loopback host lifecycle, then use the same validated encrypted result path for Ask Kairo and the remaining dashboard collections.

## Progress checkpoint — Bounded DICOM selected-file repair

2026-09-05, resumed from `9bb43b9` on `kairo-v1` only for the incomplete DICOM verification task. The baseline asset exists; the described Transfer Syntax display and startup diagnostic changes were absent from this checkout. No unrelated startup changes were made.

A synthetic Part 10 File exercised the actual DICOM file-input listener through `arrayBuffer`, metadata parsing, and UI rendering using a minimal DOM adapter. The initial test failed on Transfer Syntax. Fixed missing Transfer Syntax tag/display and parsing of long explicit-VR headers (the File Meta Information Version `OB` element disrupted following metadata).

Verification: direct Node execution of `dicom-file-selection.test.mjs` (1/1) and `dicom-core.test.mjs` (3/3) passed. Confirmed Transfer Syntax UID and Explicit VR Little Endian explanation, patient name/ID, accession, modality, study/series/SOP instance UIDs, SOP class, VR cells, summary, findings, local-read status, and byte preservation. Detailed evidence: `tools/hl7-toolkit/hl7-toolkit/VERIFICATION.md`, Stage Four bounded repair section.

The user-authorized fallback passes. Native chooser, actual Windows launcher, and browser visual acceptance remain unverified on this Linux host (no browser automation/browser executable/PowerShell runtime). Earlier ready-workspace and DICOM-navigation success are user-reported, not repeated here. This checkpoint completes only the bounded repair; stop without advancing remaining Stage Four features.

## Progress checkpoint — Stage Four task 2 redacted copy

2026-09-05, continued from committed/pushed `0cc7597`, single-thread LEAN mode. Completed the remaining workspace redacted-copy action in `dicom-core.mjs`, `dicom-ui.mjs`, and `app/index.html`; updated Stage Four plan and toolkit handoff.

- A read-only preview retains only recognized SOP class, Transfer Syntax, and modality constants. Other values (including patient/instance identifiers, dates, free text, equipment text, unknown UIDs, and filename) are omitted. This is a limited text summary, not a de-identified DICOM object.
- Copy requires review, writes only the generated preview, and reports clipboard failure with manual-copy guidance. Replacement loads clear preview/approval; failed and out-of-order reads cannot restore an old preview. DICOM table values are HTML-escaped so file content cannot alter review controls. No HL7 behavior, persistent history, network operation, or new dependency was added.
- RED: new redaction tests failed on missing function; file-handler test failed on missing copy controls. The markup regression then failed on an unescaped `<img>` value. GREEN: direct `node` runs of `tools/hl7-toolkit/tests/hl7-toolkit/dicom-redaction.test.mjs` (2/2), `dicom-file-selection.test.mjs` (1/1), and `dicom-core.test.mjs` (3/3). From `tools/hl7-toolkit`, `node tests/hl7-toolkit/ui-contract.test.mjs` passed 4/4. `git diff --check` passed.
- The production file-input/parser/render/copy listeners were exercised with synthetic Files, a minimal DOM adapter, and an injected clipboard. Verified technical retention, identifying-value exclusion, nonmutation, review gating, exact copied text, permission failure, replacement-read failure, stale-read isolation, and literal markup rendering. Native browser chooser, visual layout, and OS clipboard acceptance remain pending.

Next: user-test this workspace checkpoint using the toolkit handoff instructions. Stage Four task 3 diagnostic explainers remain unstarted; full dictionary and broader transfer-syntax support remain recorded task 1 gaps. Stage 5 was not started. Stop at this coherent checkpoint.

## Progress checkpoint — Real launcher CT/MR file-selection investigation

2026-09-05, resumed current `kairo-v1` at `5ddf641`, preserving `0cc7597` and all subsequent work. Investigated only the reported all-empty metadata failure. **Result: working in the current real browser workspace; the reported failure was not reproduced, so its original cause remains unconfirmed. No production parser/UI fix was invented or applied.**

- Downloaded unmodified pydicom v3.0.1 CT_small.dcm and MR_small.dcm. Added them with upstream license/source/hash attribution under `tools/hl7-toolkit/tests/hl7-toolkit/fixtures/pydicom/` and added `dicom-pydicom.test.mjs` plus `helpers/dicom-browser-check.mjs`.
- Complete File/ArrayBuffer lengths: CT 39,206 bytes; MR 9,830 bytes. Both have `DICM` at byte 128 and long-VR File Meta Information Version headers. Current parser returns 20/19 supported metadata fields respectively, before rendering. Both report Explicit VR Little Endian, expected CT/MR storage SOP classes, modalities, and nonempty study/series/SOP instance UIDs. Both fixtures have an actually empty Accession Number element; its absence in the summary is expected.
- Found Windows runtimes through WSL interop. Ran the actual `service/Start-HL7Toolkit.ps1` launcher script with port 8765 and temporary runtime data (the `.cmd` wrapper invokes this script). Started real Windows Chrome with a separate Windows-local temporary test profile. A WSL-hosted Chrome profile exited with filesystem-lock errors; moving only the temporary profile to Windows resolved that environment problem.
- Actual launcher reported ready. Chrome DevTools assigned each real on-disk fixture to the existing `#dicom-file` input; production change handler performed binary read → parser → render. CT rendered 20 data rows; MR rendered 19. Verified visible DICOM workspace, correct SOP/Transfer Syntax/modality and nonempty instance UID rows. Captured and visually inspected local CT/MR screenshots. No demo page, mocked API, alternate parser or overridden file handler was used.
- Targeted verification: direct Node runs of `dicom-pydicom.test.mjs` 2/2, `dicom-core.test.mjs` 3/3, `dicom-file-selection.test.mjs` 1/1, `dicom-redaction.test.mjs` 2/2 — 8 passed. Real Windows Node execution of `helpers/dicom-browser-check.mjs` against the real Chrome/launcher — CT and MR both PASS. Existing handler regression also verifies failed reads produce a status message instead of stale metadata. No permanent production diagnostics/PHI logging added.
- Manual boundary: DevTools file-input assignment exercises browser Files and the actual handler but not native OS-dialog interaction. Launcher remains running at `http://127.0.0.1:8765/`; the already-open test browser retains its session and DICOM panel, scrolled to file selection. User should select the bundled CT/MR fixtures manually. Test profile: `C:\Windows\Temp\kairo-dicom-verification`; runtime data: `/tmp/kairo-dicom-runtime`. Local screenshots `/tmp/kairo-CT_small.dcm.png` and `/tmp/kairo-MR_small.dcm.png` are not committed.

Next: confirm native chooser manually in this current running instance. If the user's separate instance still fails, its loaded files/runtime must be compared with this verified checkout; stale/wrong deployment is only a hypothesis, not an established root cause. No other Stage Four work or Stage Five work was started. Stop here.

## Progress checkpoint — Stage Five direction recovery blocked

2026-09-05, resumed `kairo-v1` at `4a05b68`. User confirms the real Windows launcher now loads known-valid CT/MR DICOM files and renders metadata correctly. Preserve all completed work; the prior native-chooser acceptance limitation is resolved by this user confirmation.

Stage Five cannot begin without product direction. Checked the authoritative ledger/handoff, toolkit product roadmap, and the Stage Two–Four specification/plan locations. No Stage Five objective, acceptance criteria, task order, or approved capability assignment exists. The September 3 product roadmap ends at Phase 4 (professional tooling); later September 5 Stage Four direction defines DICOM. That older Phase 4 list is not authority to invent or relabel Stage Five. Remaining Stage Four items stay recorded and were not resumed.

No production files changed, no tests/build/launcher probes were needed for this documentation-only recovery, and no Stage Six work began. Next required input: the approved Stage Five capability/objective or the authoritative document containing it. Once supplied, create the minimum missing specification and sequential acceptance plan, then implement through the first real-UI user-testable checkpoint under single-thread LEAN mode.

## Stage Five approved direction and task 1 — TCP service

2026-09-05: user approved vendor-neutral active endpoint diagnostics and explicitly bounded this execution to TCP + DICOM C-ECHO in the existing UI. Added the Stage Five specification and sequential plan; previous product blocker is resolved.

Task 1 added the isolated .NET diagnostics module, PowerShell adapter, and protected POST route. Real Windows helper compiles/loads it. Focused `endpoint-diagnostics.test.mjs` passed: authenticated access, zero-payload TCP connection, literal/DNS host resolution, chosen address and timestamps, invalid input rejection, bounded short-deadline failure, closed-port refusal and DNS failure/timeout. Windows closed-port refusal can take longer than 300 ms; tests distinguish that from the configured deadline instead of mislabeling a timeout. No existing HL7/DICOM behavior changed. Next: implement and test DICOM Verification before UI checkpoint publication.

Stage Five task 2 completed: Verification-only association/C-ECHO with bounded PDU/command parsing, TCP fragmentation and PDV assembly, response context/command/message-ID correlation, numeric status, rejection reason interpretation, abort and release handling. No datasets or HL7 messages are transmitted. Focused Windows service tests pass both TCP and DICOM groups, including 15 sequential DICOM peer scenarios (success/fragmentation and 13 distinct negative paths). No production diagnostics log payloads. Next required task is real UI integration and workflow verification; this internal checkpoint is not yet user-testable.

## Stage Five first user-testable checkpoint — TCP + DICOM C-ECHO

2026-09-06 completed task 3 and the approved first checkpoint from base `32888b4`. Added Diagnostics navigation, endpoint/timeout/AE inputs, explicit TCP and C-ECHO actions, and DNS → TCP → association → C-ECHO results through the existing authenticated helper. Timings, UTC timestamp, selected address, classifications and safe explanations are displayed as literal text. Inputs/buttons are locked while one diagnostic runs; no automatic runs/retries, scans, PHI transmission or result persistence. TCP uses one selected address/connection without application bytes; DICOM sends one Verification request only.

Standard-user requirement incorporated into the specification. The Windows verification process had a medium-integrity (non-elevated) token; launcher and peers inherited that token. Added code uses ordinary documented .NET DNS/TCP APIs, with no Administrator/UAC request, system configuration modification, driver, installed service, capture, raw socket, process injection or persistence. The existing Stage One launcher was not altered. A test-only token script was blocked by the host execution policy; no policy was changed or bypass added: verification now uses built-in `whoami.exe /groups` to inspect the token. Existing launcher policy handling is preserved, not extended.

A focused failure test exposed that compiling the optional module at startup could stop existing workspaces under restrictive runtime policy. Moved module loading to the first diagnostic request. Synthetic compilation denial now returns HTTP 503 / DIAGNOSTIC_RUNTIME_UNAVAILABLE, with an explanatory UI message; session and existing endpoint-profile APIs continue to work. No policy override is attempted. The final startup script has no Stage Five changes.

Verification performed sequentially, with no agents/worktrees/background diagnostic workers:
- Windows Node `tests/hl7-toolkit/endpoint-diagnostics.test.mjs` (from `tools/hl7-toolkit`): **3/3 passed**, covering protected API/input validation, TCP/DNS/refusal/deadline outcomes, policy-block fallback, and **15 DICOM peer scenarios** (including fragmented response, accepted/rejected negotiation, Called AE reason, wrong syntax, abort, bounded timeout/size, incomplete response, command/context/message mismatch, status failure and success/release). .NET module compilation occurs through the real helper.
- Node `diagnostics-ui.test.mjs`: **2/2 passed** for explicit single-request workflow, layer rendering, safe error display, busy/retry state and unavailable-runtime message.
- Existing `ui-contract.test.mjs`: **4/4 passed**; Windows `http-safety.test.mjs`: **3/3 passed**; `portable-shell.test.mjs`: **1/1 passed**. **13 targeted tests total**, no full suite.
- Windows Node `tests/hl7-toolkit/helpers/endpoint-browser-check.mjs`: **5 real UI flows passed**: TCP connected; C-ECHO success; association rejected with Called AE explanation; association accepted/C-ECHO failed; association accepted/C-ECHO timeout. Each ran through actual launcher, browser controls, authenticated API and normal socket traffic to controlled loopback peers. Existing DICOM/Inspect/Send navigation also passed. Visually inspected success and rejection screenshots. Initial browser harness navigation-context race was corrected by awaiting page load; final run passed.
- `git diff --check` passed. Test services/peers/browser were closed after verification; temporary screenshots are outside Git. No real hospital endpoint was probed, and vendor interoperability remains a user-test acceptance boundary.

Manual test: restart this checkout's `tools/hl7-toolkit/hl7-toolkit/Open HL7 Toolkit.cmd` normally, choose Diagnostics, enter one authorized host/port and run Test TCP connection. For DICOM enter registered Calling AE and destination Called AE, then Run DICOM C-ECHO. Expect independent layer results with NOT_RUN after a failing layer. Success verifies only TCP or DICOM Verification, never C-STORE/MWL/query support. Timeout is per layer (default 3000 ms); at most one resolved address is selected (prefer IPv4, otherwise IPv6), with no address fallback. Diagnostic results are session-only; DICOM-over-TLS is not implemented in this first checkpoint.

Remaining Stage Five: HTTP/HTTPS/TLS inspection; dedicated safe MLLP/ACK diagnostic integration; endpoint profiles; baseline comparison; practical evidence correlation. Stop at this checkpoint. Stage Six was not started.
