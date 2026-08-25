# Kairo V1 Definition of Done

Date: 2026-08-25
Status: **IN PROGRESS — execute the commands below before release.**

| Criterion | Status | Evidence |
|---|---|---|
| Current, planned, project/production, incident, history, and unknown knowledge boundaries | PENDING | `GenesisPrivateBenchmarkTest`; `AndroidCopilotRetrievalProjectionTest` |
| Every important answer retains evidence/source navigation and source authority | PENDING | Android retrieval/device gate; Sources/Open evidence |
| Structured, lexical, semantic, retrieval-specific, and current-state projections remain distinct and rebuildable | PENDING | `:core:retrieval:test`, `RebuildableIndexTest` |
| Imported/generated candidates require review; approval preserves scope/state; rejection does not promote; audit remains | PENDING | `:core:application:test`, Memory Inbox instrumentation |
| Synthetic PHI and credentials are locally detected; temporary use excludes durable vault, embedding, backup/archive, and cloud reasoning | PENDING | `phi-boundary.spec.ts`, `SensitiveContentScannerTest`, vault tests |
| Redacted derivative retains source lineage; originals are immutable, encrypted, content-addressed | PENDING | `SourceVaultTest` |
| Encrypted archive/import preserves durable evidence and rejects wrong/tampered passphrases; temporary sessions excluded | PENDING | `SourceVaultTest` |
| Latest migration preserves facts, evidence, hashes, scopes/states, candidate/Genesis metadata, and audit events | PENDING | migration JVM + connected tests |
| Android supports offline local browse, Quick questions, sources, and Memory Inbox; Deep Analyze is unavailable offline | PENDING | Android device gate |
| Pairing expiry/cancellation/one-time semantics, replay/sequence, corrupt/expired frames, chunk cleanup, and disconnect cleanup hold | PENDING | relay suite + `relay-retention.spec.ts` |
| Relay/browser retain no corpus, prompts, screenshots, or uploaded payloads; browser is a paired client only | PENDING | relay/desktop tests and security specs |
| Contracts are generated from schema, valid, and contain no production-write command | PENDING | `pnpm test -r` |
| APK builds, installs, launches after authentication, and retains Genesis MANA retrieval/evidence/VERIFY labels | PENDING | physical-device gate |
| No provider secret, private key, real PHI, or private Genesis payload is tracked | PENDING | secret scan below and `.private` ignore check |

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

Known non-blocking warning: current Android Gradle Plugin variant API and
Kotlin/AGP option warnings are pre-existing and do not hide test failures.
