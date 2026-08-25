# SDD ledger — plan: docs/superpowers/plans/2026-08-20-kairo-v1-implementation.md

Workspace: C:/Users/rdunn/Documents/Codex/2026-08-20/referenced-chatgpt-conversation-this-is-an/.worktrees/kairo-v1
Branch: kairo-v1
Merge base: 84075ac
Remote: https://github.com/zedjazz76/Kairo.git

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

The prior Task 1–10 work history remains in repository history; this checkpoint records the final Task 11 and Task 12 implementation states and the current Task 13 progress.
