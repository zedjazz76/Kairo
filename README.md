# Kairo

Kairo is a local-first clinical-systems copilot with an evidence-backed Core.
The V1 source tree starts with versioned contracts shared by Android, browser,
and relay components.

## Contract checks

Install the workspace and run the root contract check:

```powershell
pnpm install --frozen-lockfile
pnpm test --filter @kairo/contracts
```

With Java 17 and pnpm available on `PATH`, the checked-in Gradle 9.6.1 wrapper
also exposes the same contract suite through the JVM build entry point:

```powershell
.\gradlew.bat verifyContracts
```

The Gradle `check` lifecycle task depends on `verifyContracts`.

## Contract locations

- `shared/contracts/schemas/` contains JSON Schema contracts for answers and
  Core command/result envelopes.
- `shared/contracts/openapi/` describes the V1 relay pairing and encrypted
  tunnel routing boundary.
