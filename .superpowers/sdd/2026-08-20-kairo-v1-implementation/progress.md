# SDD ledger — plan: docs/superpowers/plans/2026-08-20-kairo-v1-implementation.md

Workspace: C:/Users/rdunn/Documents/Codex/2026-08-20/referenced-chatgpt-conversation-this-is-an/.worktrees/kairo-v1
Branch: kairo-v1
Merge base: 84075ac
Remote: https://github.com/zedjazz76/Kairo.git

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
