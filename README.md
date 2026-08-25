# Kairo

Kairo ("KYE-roh") is a local-first, advisory-only Clinical Systems Copilot.
Android hosts the single authoritative V1 Core: Room-backed evidence, Source
Vault, Memory Inbox, and local retrieval. The browser is a paired client over
an encrypted live-only relay; it is never a second knowledge store and has no
direct PACS, RIS, EHR, or production-write capability.

## V1 boundaries

- Local Quick retrieval, source navigation, and Memory Inbox work offline.
- Planned, VERIFY, project, and incident evidence remains qualified rather
  than becoming current MANA production truth.
- Genesis/private corpus payloads remain local and ignored; do not commit
  `.private/` content, provider credentials, source originals, or PHI.
- Deep Analyze is advisory-only and unavailable when cloud reasoning is not
  permitted. No production clinical-system write command exists.

## Build and release gate

Prerequisites: Java 17, Android SDK, Node 22, and the pinned pnpm version.
Corepack can install it locally with `corepack enable pnpm`.

```bash
pnpm install --frozen-lockfile
pnpm test -r
pnpm --filter @kairo/desktop-web e2e
./gradlew --no-daemon check :apps:android:assembleDebug
pnpm audit --prod
```

`validation/e2e/DefinitionOfDoneTest.kt` is part of Gradle `check`; security
release checks run with the workspace test command. GitHub Actions runs all
hosted checks. Physical-device instrumentation, APK install/launch, local
retrieval, evidence navigation, and authentication remain an explicit manual
release gate on an authorized Android device.

## Contract locations

- `shared/contracts/schemas/` contains authoritative JSON Schema contracts.
- `shared/contracts/openapi/` describes the pairing and encrypted tunnel.
- Generated contracts are derived artifacts and must not be edited manually.
