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

The checked-in Gradle settings reserve the JVM build entry point. A Gradle
wrapper and Java toolchain are not yet available in this environment, so
`gradlew.bat tasks` cannot be run until those prerequisites are provided.

## Contract locations

- `shared/contracts/schemas/` contains JSON Schema contracts for answers and
  Core command/result envelopes.
- `shared/contracts/openapi/` describes the V1 relay pairing and encrypted
  tunnel routing boundary.
