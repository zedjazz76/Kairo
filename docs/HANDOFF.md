# Kairo — Detailed Development Handoff

**Repository:** `https://github.com/zedjazz76/Kairo` (private)
**Branch to continue:** `kairo-v1`
**Latest published commit:** `452a3d0` — `feat: add resumable artifact ingestion foundation`
**Handoff date:** 2026-08-21

This file is the portable continuation record for a new Codex/ChatGPT session on the Android-development laptop or Ubuntu server. It supplements, but does not replace, the approved design, implementation plan, and Superpowers recovery ledger.

## Non-negotiable product decisions

Read these documents before changing behavior:

1. `docs/superpowers/specs/2026-08-20-kairo-design.md` — locked Kairo Design Specification.
2. `docs/superpowers/plans/2026-08-20-kairo-v1-implementation.md` — approved task sequence.
3. `.superpowers/sdd/2026-08-20-kairo-v1-implementation/progress.md` — detailed review, verification, and recovery evidence.

Preserve these decisions:

- Kairo is a local-first MANA **Radiology Workflow** knowledge copilot, not a cardiology product.
- Universal Knowledge Artifact Ingestion is a flagship V1 capability: PDF/scanned PDF, DOCX, XLSX, CSV, TXT, Markdown, PNG/JPEG/screenshots, pasted text, and contextual multi-artifact capture sessions.
- Kairo Core is authoritative and multi-client. Android is the V1 client; browser desktop is deferred, not removed. Do not create another knowledge store for a client.
- Maintain MANA current vs. planned architecture distinctions. Claims require scope, time, evidence state, and provenance.
- Preserve PHI/session boundaries: raw sensitive content may be temporary only; it must not silently reach durable storage, embeddings, archives, backups, or external reasoning.
- Evidence and temporal history are append-only. Human approval is required before AI-generated candidates become active knowledge.
- Keep Deep Analyze. Desktop is deferred to save scope, but the contracts must remain capable of supporting it later.

## Working mode agreed with the user

The full user-approved operating agreement is preserved at
`docs/superpowers/kairo-lean-mode-override.md`. It is part of this handoff and
remains controlling unless Robert explicitly changes it.

In brief:

- Use one primary agent only; do not start subagents, hidden monitors, background tasks, or automatic re-review loops unless the user explicitly asks.
- Keep focused TDD: write a small failing test, implement only enough to pass, then run the smallest relevant test target.
- Do not rerun large/full suites after every small task. Use milestone/release verification later.
- Record short, factual checkpoints in the Superpowers progress ledger.
- Commit and push clean checkpoints to `kairo-v1` when authorized. The user has authorized publishing approved checkpoints to the private GitHub repository.
- Do not restart completed work or rewrite earlier architecture without an approved reason.

## Completed work

| Task | Status | Key commits | Verification / notes |
|---|---|---|---|
| 1 — contracts/workspace | Complete | `3ca91d0` | Contract gate passed 12/12. |
| 2 — temporal evidence/domain | Complete | `25941eb` | Domain tests and contract tests passed; duplicate fact IDs rejected deterministically. |
| 3 — sources, anchors, workflows, projects | Complete | `4114ef3` | Domain tests and contract tests passed; provenance and MANA/project scope rules added. |
| 4 — Room persistence | Complete | `fff8488`, `26a7fe1` | JVM Room/repository tests and instrumentation-test compilation passed earlier. Connected-device tests remain for laptop. |
| 5 — encrypted Source Vault / PHI boundary | Complete | `0e66c30` | Focused Android JVM vault/security verification passed. |
| 6 — universal ingestion | Complete | `452a3d0` through current Task 6 milestone | Launch formats, real image/scanned-PDF OCR, durable encrypted resume, WorkManager scheduling, and focused milestone verification passed. |

## Exact current code state

### Task 5: Source Vault

Implemented under `platform/android/src/main/kotlin/kairo/platform/vault/` and `core/security/`:

- AES-GCM encrypted, SHA-256-addressed durable blobs.
- Immutable source import records and explicit derivatives.
- Encrypted cache-backed temporary sessions with clear behavior.
- Passphrase-authenticated archive export/import excluding temporary sessions.
- Local scanner/policy for likely PHI and credentials.
- `AndroidKeystoreMasterKeyProvider` was added in commit `0e66c30`.

Focused Android JVM verification passed:

```bash
./gradlew :platform:android:testDebugUnitTest --tests '*SourceVaultTest' --tests '*SensitiveContentScannerTest'
```

### Task 6: Ingestion

Implemented:

- `core/ingestion` Gradle module.
- `ArtifactFormat`, artifact/extractor contracts, structural anchor retention, explicit extraction ports.
- `IngestionPipeline` with batch context, PHI-review pause/resume, candidate drafts, and idempotent checkpoint contracts.
- Structured PDF extraction with page anchors, DOCX ZIP/XML paragraph extraction, and XLSX ZIP/XML sheet/range extraction.
- Android image OCR plus scanned-PDF fallback orchestration.
- Real ML Kit image OCR and Android `PdfRenderer` + ML Kit scanned-PDF OCR passed on a connected device.
- Room-backed checkpoint metadata with encrypted temporary artifact/extraction payloads and restart-safe evidence anchors.
- Unique WorkManager scheduling, custom `KairoWorkerFactory`, and Android runtime reconstruction from durable stores.
- Launch coverage for PDF/scanned PDF, DOCX, XLSX, CSV, TXT, Markdown, PNG, JPEG/screenshots, and pasted text.

Verified locally:

```bash
./gradlew :core:ingestion:test
```

Task 6 milestone verification passed:

```bash
./gradlew :core:ingestion:test :platform:android:testDebugUnitTest
```

## Deferred items that must not be forgotten

- Android connected-device tests from Task 4 and later Android UI work.
- SQLite-level enforcement that a source variant parent belongs to the same source.
- Stronger migration assertions for persisted evidence anchors/confidence and temporal fields.
- Task 3 value-semantics review for context records in the final whole-branch review.
- Task 11 app composition must install `KairoWorkerFactory(AndroidIngestionRuntimeFactory(...))` in WorkManager configuration; Task 6 provides and tests those components without creating a premature app bootstrap.
- Tasks 7–15 remain unimplemented. Task 7 must use `MemoryCandidateDraft` from Task 6 and preserve the human approval gate.
- The APK test milestone is after Task 11. Desktop Tasks 12–13 remain deferred; do not remove their Core-ready contracts.

## Laptop / Ubuntu setup

Clone the private branch:

```bash
git clone -b kairo-v1 https://github.com/zedjazz76/Kairo.git
cd Kairo
```

Required local tools:

- JDK 17.
- Android SDK with platform 36 and build tools, configured through `ANDROID_HOME` or an untracked `local.properties` file.
- Android emulator/device only when the plan calls for connected tests.
- Git credentials that can access the private repository.

Do not commit `local.properties`, Android SDK paths, credentials, cache directories, device data, or generated APKs.

## Safe continuation sequence

1. Confirm the working tree and branch:

```bash
git status --short
git branch --show-current
git log -1 --oneline
```

Expected branch: `kairo-v1`; expected current baseline: `452a3d0` or a later approved checkpoint.

2. Read the three governing documents listed above.

3. Establish the Android SDK locally, then rerun the Task 5 targeted Android tests.

4. Complete Task 6 honestly—real extraction/OCR, durable resume, fixtures, and Android tests—before claiming universal ingestion is done.

5. Resume Task 7 from its written test-first plan. Do not leap directly to UI or desktop work.

6. Stop for the first real APK/device test after Task 11, as requested by the user. Before that test, update this handoff and the recovery ledger with actual verification results.

## Prompt for a new Codex / ChatGPT session

```text
Continue Kairo from private GitHub branch kairo-v1. First read docs/HANDOFF.md,
docs/superpowers/specs/2026-08-20-kairo-design.md,
docs/superpowers/plans/2026-08-20-kairo-v1-implementation.md, and
.superpowers/sdd/2026-08-20-kairo-v1-implementation/progress.md.

Use the Kairo Superpowers Lean-Mode Override: no subagents, no hidden/background
processes, focused TDD, concise recovery-ledger updates, and clean pushed checkpoints.
Do not restart completed Tasks 1–5. Task 6 is only a tested core foundation at
commit 452a3d0; complete real Android-safe extraction/OCR, durable resume,
fixtures, and Android verification before marking it complete. Keep Deep Analyze;
desktop remains deferred but its Core-ready contracts must remain intact. Stop at
the first genuine Android APK/device test point after Task 11.
```

## What this handoff does not carry

It carries the project’s durable technical context through version-controlled files. It does not contain personal Codex chat memory, local SDK paths, credentials, Android device state, or files outside this repository. Those must stay local to the appropriate machine.
