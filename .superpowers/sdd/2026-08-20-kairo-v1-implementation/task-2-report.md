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

---

## Fix round 1 — temporal supersession and immutable snapshots

### Status

Complete. Later same-scope current revisions now retire their predecessor;
planned, proposed, and hypothesis successors do not. Terminal contradiction
and deprecation retirement follows the same scope boundary. All source
versions remain in chronological history.

### RED

The focused command
`gradlew.bat --no-daemon :core:domain:test --tests "*TemporalProjectionTest"`
executed 14 tests and failed four intended regressions:

- a newer OBSERVED revision did not retire a CONFIRMED predecessor;
- a PROJECT contradiction incorrectly retired MANA production truth;
- a cleared caller-owned `MutableSet` cleared `FactVersion.evidence`;
- clearing caller-owned projection lists altered `CurrentBestUnderstanding`.

The sandboxed Kotlin daemon could not write its local client marker and fell
back to in-process compilation; test execution itself completed. Elevated
verification used the system Kotlin cache without that fallback.

### GREEN

- Focused `TemporalProjectionTest` passed in 10 seconds after the fix.
- `gradlew.bat --no-daemon :core:domain:test verifyContracts` passed in 6
  seconds. Contract verification reported 12 passes and zero failures.
- `git diff --check` passed before commit.

### Added coverage

- Same-scope current revision retirement, and planned successor non-retirement.
- Scope isolation for project terminal successors versus MANA production.
- Concurrent MANA/project precedence.
- Inclusive `effectiveFrom` and exclusive `effectiveTo` boundaries.
- Deterministic equal-timestamp current/history ordering.
- Immutable evidence, current, and history snapshots plus `FactVersion.copy`.

### Implementation notes

- `FactVersion` is now a value-semantic immutable class with an explicit
  `copy`, `equals`, `hashCode`, and `toString`, preserving its public fields
  while taking an unmodifiable evidence snapshot.
- `CurrentBestUnderstanding` takes unmodifiable snapshots of both public
  lists.
- `.kotlin/` is ignored as generated local compiler state and was not staged.

### Commit

- `fix: preserve temporal scope boundaries and snapshots` (this round's local
  commit includes this report update)
