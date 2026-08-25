# Kairo V1 Definition of Done

Date: 2026-08-25
Status: **PASS — Task 15 technical Definition of Done is release-gated.**

| Criterion | Status | Evidence |
|---|---|---|
| Current, planned, project/production, incident, history, and unknown knowledge boundaries | PASS | `GenesisPrivateBenchmarkTest`; `AndroidCopilotRetrievalProjectionTest`; 2026-08-25 device answers below |
| Every important answer retains evidence/source navigation and source authority | PASS | 2026-08-25 device: Projects → Open evidence → Sources overview with curated source IDs and confidence |
| Structured, lexical, semantic, retrieval-specific, and current-state projections remain distinct and rebuildable | PASS | `:core:retrieval:test`; `RebuildableIndexTest` |
| Imported/generated candidates require review; approval preserves scope/state; rejection does not promote; audit remains | PASS | `:core:application:test`; `MemoryInboxApprovalTest`; live Genesis approval to `Inbox clear` |
| Synthetic PHI and credentials are locally detected; temporary use excludes durable vault, embedding, backup/archive, and cloud reasoning | PASS | `phi-boundary.spec.ts`; `SensitiveContentScannerTest`; vault tests |
| Redacted derivative retains source lineage; originals are immutable, encrypted, content-addressed | PASS | `SourceVaultTest` |
| Encrypted archive/import preserves durable evidence and rejects wrong/tampered passphrases; temporary sessions excluded | PASS | `SourceVaultTest` |
| Latest migration preserves facts, evidence, hashes, scopes/states, candidate/Genesis metadata, and audit events | PASS | migration JVM coverage; `KnowledgeMigrationTest` connected instrumentation (1/1) |
| Android supports offline local browse, Quick questions, sources, and Memory Inbox; Deep Analyze is unavailable offline | PASS | 2026-08-25 authorized-device gate on `R5GYC4YHMNN` |
| Pairing expiry/cancellation/one-time semantics, replay/sequence, corrupt/expired frames, chunk cleanup, and disconnect cleanup hold | PASS | relay suite; `relay-retention.spec.ts` |
| Relay/browser retain no corpus, prompts, screenshots, or uploaded payloads; browser is a paired client only | PASS | relay/desktop tests; `relay-retention.spec.ts`; desktop Playwright E2E |
| Contracts are generated from schema, valid, and contain no production-write command | PASS | `pnpm test -r` (12 contracts + 2 security tests) |
| APK builds, installs, launches after authentication, and retains Genesis MANA retrieval/evidence/VERIFY labels | PASS | fresh debug APK build/install/launch; 2026-08-25 authorized-device smoke |
| No provider secret, private key, real PHI, or private Genesis payload is tracked | PASS | final `git grep` scan; `.private` ignore check; all synthetic validation markers excluded from production paths |

## Hosted release commands

```bash
pnpm install --frozen-lockfile
pnpm test -r
pnpm --filter @kairo/desktop-web e2e
./gradlew --no-daemon check :apps:android:assembleDebug
pnpm audit --prod
git grep -n -E '(sk-[A-Za-z0-9_-]{20,}|BEGIN (RSA|EC|OPENSSH) PRIVATE KEY|patient[M]rnTestValue)' -- ':!validation/fixtures/synthetic/**'
git diff --check
```

## Manual physical-device gate

On an authorized Android device: install the fresh APK, launch and authenticate
without bypass, approve Genesis through Memory Inbox, verify offline local
retrieval and Sources/Open evidence, then verify PACS, planned PROJECT
AbbaDox/ViewPoint, INCIDENT GSPS, and VERIFY endpoint behavior. Record the
device identifier and exact result in `progress.md` before changing this table
to PASS.

## Executed release evidence

- `./gradlew --no-daemon check` — PASS (2026-08-25; 1m 43s).
- `pnpm test -r` — PASS (12 contract tests; 2 security tests).
- `KAIRO_PLAYWRIGHT_EXECUTABLE=/usr/bin/google-chrome pnpm --filter @kairo/desktop-web e2e` — PASS (1/1).
- `pnpm audit --prod` — PASS; no known vulnerabilities.
- `:platform:android:connectedDebugAndroidTest ... KnowledgeMigrationTest` — PASS (1/1 on SM-S176V).
- `:apps:android:connectedDebugAndroidTest ... KairoActivityTest, MemoryInboxApprovalTest, AndroidCopilotRetrievalProjectionTest` — PASS (8/8 on SM-S176V).
- Fresh `:apps:android:assembleDebug`, `adb install -r`, launch, authentication, and the manual gate below — PASS.
- `git diff --check` and the documented secret/PHI scan — PASS.

## Manual physical-device result

Authorized device `R5GYC4YHMNN` (Samsung SM-S176V), 2026-08-25:

- Approved the staged curated Genesis batch through Memory Inbox; the screen changed to `Inbox clear`.
- Offline home screen stated local knowledge remains available and Deep reasoning is unavailable.
- Copilot returned `Merge / AMICAS PACS` for MANA PACS.
- Planned answers retained scope: `AbbaDox CareFlow for non-breast imaging` and `Rad AI direction` both displayed `Planned [PROJECT]`.
- GSPS was returned as `Observed [INCIDENT]`; unsupported Altamont AE Title/port details remained `requires verification` under `[PROJECT]`.
- Projects → `Open evidence` reached Sources overview and displayed curated Genesis source IDs and 100% confidence.

Known non-blocking warnings: pre-existing Android Gradle Plugin variant API/Kotlin
option warnings and Node's module-type warning for the TypeScript security specs.
They did not hide any failed test.
