# Task 2 report — temporal evidence domain core

## Status

Complete. The `:core:domain` module contains immutable, evidence-backed fact
versions and a current-best projection that keeps planned, project, expired,
deprecated, and contradicted assertions in retained history rather than
presenting them as current production truth.

## TDD evidence

### RED

1. The first focused run could not resolve the Kotlin JVM Gradle plugin from
   the workspace-local cache. An offline diagnostic reported that
   `org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin:2.0.21`
   was unavailable from the configured plugin repositories.
2. Network diagnosis established that Java was not inheriting the machine
   proxy and repeatedly received `java.net.SocketException: Connection reset`
   from `dl.google.com:443`. Repository priority was changed to Maven Central,
   Gradle Plugin Portal, then Google, preserving Google for future Android
   dependencies while avoiding that endpoint first.
3. With the controller-provided temporary `JAVA_TOOL_OPTIONS` proxy, the exact
   focused command reached `:core:domain:compileTestKotlin` and failed with
   unresolved `KnowledgeScope`, `EvidenceState`, `CurrentBestUnderstanding`,
   `EvidenceRef`, `FactId`, `FactVersion`, `EntityId`, and `FactObject`.
4. After adding the expired-fact boundary test, the focused command was run
   again with all domain production files absent. It failed at
   `:core:domain:compileTestKotlin` with the same intended unresolved domain
   symbols.

### GREEN

- `gradlew.bat --no-daemon :core:domain:test --tests "*TemporalProjectionTest"`
  passed in 10 seconds.
- `gradlew.bat --no-daemon :core:domain:test` passed in 5 seconds.
- `gradlew.bat --no-daemon verifyContracts` passed with all 12 contract tests
  green after prepending the controller-provided runtime-only Node and pnpm
  directories to `PATH`.
- `git diff --check` passed.

## Behavior covered

- A planned project fact does not displace a confirmed MANA production fact.
- Contradictory revisions preserve both versions in chronology and retire the
  superseded claim from current understanding.
- Expired confirmed facts remain available in history but are not current.
- Important active evidence states require source evidence.
- Machine extraction confidence is carried by `EvidenceRef`, independently of
  the user-facing `EvidenceState`.
- Kotlin scope and evidence-state enum names exactly match the Task 1 contract.

## Changed files

- `settings.gradle.kts`
- `core/domain/build.gradle.kts`
- `core/domain/src/main/kotlin/kairo/domain/Knowledge.kt`
- `core/domain/src/main/kotlin/kairo/domain/Fact.kt`
- `core/domain/src/main/kotlin/kairo/domain/Evidence.kt`
- `core/domain/src/main/kotlin/kairo/domain/TemporalProjection.kt`
- `core/domain/src/test/kotlin/kairo/domain/TemporalProjectionTest.kt`
- `.superpowers/sdd/2026-08-20-kairo-v1-implementation/task-2-report.md`

## Commit

- `feat: add temporal evidence domain core` (this report is included in that
  local commit)

## Concerns

- Gradle reported existing deprecation notices for Gradle 10 compatibility;
  this task adds no deprecated API use.
- The proxy and runtime `PATH` additions were process-local verification aids
  only and were not committed.
