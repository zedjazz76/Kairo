# Task 4 report — authoritative Room persistence and migration safety

## Status

Complete. The Room/SQLite adapter persists the authoritative evidence graph in normalized tables, keeps fact versions append-only, writes evidence and audit rows transactionally, preserves reviewed domain projection semantics, enforces source/variant anchor coherence, deduplicates content identity without collapsing imports, and provides a validated v1-to-v2 migration.

## Baseline and environment

- Worktree baseline: `4114ef3` on `kairo-v1`.
- Gradle wrapper: 9.6.1.
- JDK: workspace Temurin 17.0.20.
- Android: AGP 9.3.1, compile SDK 36, instrumentation target SDK 36, minimum SDK 26.
- Persistence: Room 2.8.4 with KSP 2.2.10-2.0.2 and Kotlin 2.2.10.
- The workspace-local ignored Android SDK was installed through AGP's supported SDK downloader. Installed packages were Android Platform 36 revision 2, Build Tools 36.0.0, and platform-tools 37.0.1. No SDK, cache, `local.properties`, or absolute machine path is tracked.
- Java/Gradle downloads required the already-established process-local proxy properties. Direct Java TLS to Maven repositories was reset; no proxy setting was committed.
- No Android device or emulator is available. `androidTest` compiled successfully; `connectedDebugAndroidTest` was not run and is deferred to the Android/release environment.

The repeatable PowerShell environment used for verification was:

```powershell
$workspace = (Resolve-Path '..\..').Path
$env:JAVA_HOME = Join-Path $workspace 'work\toolchains\temurin17\PFiles64\Eclipse Adoptium\jdk-17.0.20.8-hotspot'
$env:GRADLE_USER_HOME = Join-Path $PWD 'work\gradle-user-home'
$env:ANDROID_HOME = Join-Path $PWD 'work\android-sdk'
$env:ANDROID_USER_HOME = Join-Path $PWD 'work\android-user-home'
$env:JAVA_TOOL_OPTIONS = '-Dhttps.proxyHost=172.30.1.19 -Dhttps.proxyPort=8080 -Dhttp.proxyHost=172.30.1.19 -Dhttp.proxyPort=8080'
$env:PATH = "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback;$env:PATH"
$testTemp = Join-Path $workspace 'work\r'
```

## RED evidence

### Explicit fact lineage

The focused domain test was written before the domain change:

```powershell
.\gradlew.bat :core:domain:test --tests kairo.domain.TemporalProjectionTest '-Pkotlin.compiler.execution.strategy=in-process' --no-daemon --console=plain
```

Result: expected failure. Kotlin reported unresolved `FactLineageId`, unresolved `lineageId`, and no matching `copy(lineageId = ...)` parameter. This proved the root-default, copy-preservation, and value-semantics tests exercised absent behavior.

### Repository and migration boundary

Repository and JVM/instrumented migration tests were added before Room production types:

```powershell
.\gradlew.bat :platform:android:testDebugUnitTest --tests 'kairo.platform.db.RoomKnowledgeRepositoryTest' --tests 'kairo.platform.db.KnowledgeMigrationJvmTest' '-Pkotlin.compiler.execution.strategy=in-process' --no-daemon --console=plain
```

Result: expected compile failure in `compileDebugUnitTestKotlin`; `kairo.application`, `KairoDatabase`, and `RoomKnowledgeRepository` were unresolved. This was the intended repository/migration RED before implementation.

### Anchor lineage coherence found during self-review

```powershell
.\gradlew.bat :platform:android:testDebugUnitTest --tests 'kairo.platform.db.RoomKnowledgeRepositoryTest.capture session rejects an anchor whose variant belongs to another source' "-Pkairo.testTempDir=$testTemp" '-Pkotlin.compiler.execution.strategy=in-process' --no-daemon --console=plain
```

Result: expected one-test failure at the `assertFailsWith` assertion. Separate source and variant foreign keys accepted an incoherent cross-source pair. The schema was then tightened to a unique `(source_id, variant_id)` parent key and composite child foreign keys.

### Fractional timestamp ordering found during self-review

```powershell
.\gradlew.bat :platform:android:testDebugUnitTest --tests 'kairo.platform.db.RoomKnowledgeRepositoryTest.history orders fractional instants chronologically' "-Pkairo.testTempDir=$testTemp" '-Pkotlin.compiler.execution.strategy=in-process' --no-daemon --console=plain
```

Result: expected one-test failure. SQLite TEXT ordering placed `...00.100Z` before `...00Z`. Repository history now parses persisted timestamps through the domain mapper and deterministically sorts by `(recordedAt, FactId)`.

## GREEN evidence

### Lineage

```powershell
.\gradlew.bat :core:domain:test --tests kairo.domain.TemporalProjectionTest '-Pkotlin.compiler.execution.strategy=in-process' --no-daemon --console=plain
```

Result: `BUILD SUCCESSFUL`. `FactLineageId` rejects blanks; root facts default lineage from `FactId`; successor copies preserve lineage; equality, hash, and string representations include lineage.

### Focused Room repository and migration gate

```powershell
.\gradlew.bat :platform:android:testDebugUnitTest --tests 'kairo.platform.db.RoomKnowledgeRepositoryTest' --tests 'kairo.platform.db.KnowledgeMigrationJvmTest' "-Pkairo.testTempDir=$testTemp" '-Pkotlin.compiler.execution.strategy=in-process' --no-daemon --console=plain
```

Result before final self-review additions: `BUILD SUCCESSFUL`, 8 tests, 0 failures. This included seven repository behaviors and the JVM v1-to-v2 migration. After the timestamp test was added, the final all-Android command below ran 9 tests, 0 failures.

### Instrumentation-test compilation

```powershell
.\gradlew.bat :platform:android:compileDebugAndroidTestKotlin '-Pkotlin.compiler.execution.strategy=in-process' --no-daemon --console=plain
```

Result: `BUILD SUCCESSFUL`. The AndroidJUnit4 migration test compiled against SDK 36. It was not executed because no device/emulator exists.

### Final combined gate

```powershell
.\gradlew.bat :core:domain:test :platform:android:testDebugUnitTest :platform:android:compileDebugAndroidTestKotlin verifyContracts "-Pkairo.testTempDir=$testTemp" '-Pkotlin.compiler.execution.strategy=in-process' --no-daemon --console=plain
```

Final result: `BUILD SUCCESSFUL`.

- Domain: 36 tests, 0 failures/errors.
- Android JVM: 9 tests, 0 failures/errors (8 repository tests plus 1 JVM migration test).
- Root contracts: 12 tests, 12 passed.
- Instrumentation migration source: compiled successfully.

```powershell
git diff --check
```

Result: exit 0; no whitespace errors. Git only reported the existing Windows LF-to-CRLF advisory.

## Schema and transaction evidence

The committed Room v2 schema exports nine normalized tables:

1. `content_identities`
2. `sources`
3. `source_variants`
4. `source_anchors`
5. `fact_versions`
6. `fact_evidence`
7. `capture_sessions`
8. `capture_session_anchors`
9. `audit_events`

The schema provides:

- globally unique primary-keyed fact versions with ABORT insertion (no update/replace DAO exists);
- explicit indexed lineage and self-referential predecessor foreign keys with `NO ACTION` deletion/update behavior;
- indexed subject/predicate/object, scope, evidence state, effective time, recorded time, lineage, source identity, variant lineage, and audit correlation fields;
- unique hash identities referenced by multiple distinct source/import records;
- a unique source/version constraint and parent-variant lineage foreign key;
- composite source/variant foreign keys for both source anchors and Capture Session anchors, preventing provenance pairs from crossing sources;
- evidence foreign keys to both immutable fact rows and source imports;
- one `withTransaction` boundary per append/save operation, covering the authoritative row(s) and audit event.

The JVM migration fixture creates and populates a genuine version-1 SQLite schema, opens it through Room with `MIGRATION_1_2`, thereby running Room's schema validation, and proves preservation of:

- fact ID and lineage;
- MANA production scope and temporal fields;
- source hash/import metadata;
- evidence link and confidence;
- audit event;
- synthesized root source variant needed by the v2 domain model.

The equivalent AndroidJUnit4 fixture is present under `src/androidTest` and compiled successfully.

## Behavior covered

- Appending a successor never changes/deletes the predecessor; lineage history returns all versions in true chronological order with `FactId` tie-breaking.
- Duplicate `FactId` insertion aborts instead of replacing history.
- A duplicate audit ID forces fact/evidence/audit rollback as one transaction.
- Current-understanding mapping delegates to reviewed `CurrentBestUnderstanding.project`; project knowledge cannot be promoted into MANA production truth by persistence.
- Scope, evidence state, object type/value, effective/recorded/validation times, lineage, predecessor, and evidence round-trip exactly.
- All five anchor locator variants round-trip through source variants and Capture Sessions.
- Domain/source/session/evidence collections remain defensive immutable snapshots after reads.
- Identical content hashes produce one content-identity row while retaining two distinct source/import rows.

## Compatibility evidence and limitations

1. AGP 9.3.1 built-in Kotlin initially rejected KSP's generated Kotlin source registration with: `Using kotlin.sourceSets DSL to add Kotlin sources is not allowed with built-in Kotlin`. The smallest compatible adjustment was the AGP-supported `android.disallowKotlinSourceSets=false` project option. No dependency version was downgraded.
2. The build emits the corresponding experimental-option warning. This should be removed when KSP/AGP no longer requires the compatibility path.
3. The build also warns that Kotlin is loaded in both `:core:application` and `:platform:android`. Centralizing the plugin was tested and failed while applying AGP with missing legacy `com/android/build/gradle/api/BaseVariant`; the change was reverted. The working pinned baseline compiles and all gates pass.
4. Robolectric 4.16.1's internal artifact fetcher could not create its deep staging path in this long Windows worktree. A dedicated Gradle configuration now resolves the exact supported runtime artifact (`android-all-instrumented:15-robolectric-13954326-i7`), copies it into ignored module build output, and points Robolectric's supported offline dependency directory at it.
5. Robolectric reports that Android SDK 36 execution requires Java 21. JVM tests therefore explicitly run its Android 15/SDK 35 runtime under the mandated workspace JDK 17; production and `androidTest` compilation use SDK 36.
6. The long workspace path also exceeds Windows legacy path limits for Robolectric-generated test database names. The optional uncommitted `kairo.testTempDir` Gradle property redirects runtime scratch space to a shorter ignored workspace directory.
7. No device test was run. The compiled `androidTest` migration remains a required release-environment gate.

## Changed files

- `core/domain/build.gradle.kts`
- `core/domain/src/main/kotlin/kairo/domain/Fact.kt`
- `core/domain/src/main/kotlin/kairo/domain/Knowledge.kt`
- `core/domain/src/test/kotlin/kairo/domain/TemporalProjectionTest.kt`
- `core/application/build.gradle.kts`
- `core/application/src/main/kotlin/kairo/application/KnowledgeRepository.kt`
- `settings.gradle.kts`
- `gradle.properties`
- `platform/android/build.gradle.kts`
- `platform/android/schemas/kairo.platform.db.KairoDatabase/2.json`
- `platform/android/src/main/AndroidManifest.xml`
- `platform/android/src/main/kotlin/kairo/platform/db/KairoDatabase.kt`
- `platform/android/src/main/kotlin/kairo/platform/db/KnowledgeEntities.kt`
- `platform/android/src/main/kotlin/kairo/platform/db/RoomKnowledgeRepository.kt`
- `platform/android/src/test/kotlin/kairo/platform/db/KnowledgeMigrationJvmTest.kt`
- `platform/android/src/test/kotlin/kairo/platform/db/RoomKnowledgeRepositoryTest.kt`
- `platform/android/src/androidTest/kotlin/kairo/platform/db/KnowledgeMigrationTest.kt`
- `.superpowers/sdd/2026-08-20-kairo-v1-implementation/task-4-report.md`

## Self-review

- Compared the public application interface to the brief and kept its exact five required operations. Adapter-specific source/session read methods remain concrete methods used to prove persistence round trips.
- Confirmed there is no update, delete, replace, or cascade path for authoritative fact history.
- Confirmed every mutable domain collection is reconstructed through defensive domain snapshots; repository history is additionally returned as an unmodifiable list.
- Confirmed all enum/object/anchor mappings are exhaustive and fail closed on unknown persisted discriminators.
- Confirmed migration DDL is accepted by Room against the exported v2 schema, including all indexes and composite foreign keys.
- Confirmed SDKs, Gradle/Kotlin/Robolectric caches, generated build output, and machine configuration remain ignored and untracked.
- Added regression coverage for the two issues found during review: composite anchor coherence and fractional timestamp ordering.

## Commit

- `feat: persist authoritative evidence graph with Room` (local only; not pushed)

## Concerns

- Device SQLite/Room behavior still needs `connectedDebugAndroidTest` in an environment with an Android device or emulator.
- The KSP compatibility flag and duplicate Kotlin-plugin warning are known build-tool concerns described above; neither changes runtime semantics, and all compile/test gates are green.

## Fix round 1/5 — preserve cross-key supersession during repository queries

### Reviewer finding and verification

The finding was confirmed. `RoomKnowledgeRepository.currentUnderstanding()` previously passed a subject/predicate-filtered subset of fact rows into `CurrentBestUnderstanding.project()`. The reviewed domain projection computes retirement from explicit predecessor/successor relationships before grouping current facts by subject/predicate. A current eligible successor that changed subject or predicate was absent from the repository's prefiltered subset, so its predecessor could be incorrectly returned as current for the old key.

The two deferred Minor review candidates were intentionally left unchanged in this round.

### RED

A real Room regression was added before the production change. It persists a confirmed predecessor with predicate `USES`, appends a later confirmed successor in the same lineage that changes the predicate to `ROUTES_TO`, and queries both the old and new keys.

```powershell
.\gradlew.bat :platform:android:testDebugUnitTest --tests 'kairo.platform.db.RoomKnowledgeRepositoryTest.querying an old predicate does not resurrect its cross-key predecessor' "-Pkairo.testTempDir=$testTemp" '-Pkotlin.compiler.execution.strategy=in-process' --no-daemon --console=plain
```

Result: expected failure, 1 test executed and 1 failed at `RoomKnowledgeRepositoryTest.kt:180`. The old-key result contained the retired predecessor because the successor had been filtered out before projection.

### GREEN

The DAO now loads the complete authoritative `fact_versions` set for projection. `currentUnderstanding()` delegates that complete graph to `CurrentBestUnderstanding.project()` at the requested instant and only then applies the optional subject/predicate query filters to projected current results. The returned filtered list is wrapped as an immutable defensive snapshot.

Focused regression:

```powershell
.\gradlew.bat :platform:android:testDebugUnitTest --tests 'kairo.platform.db.RoomKnowledgeRepositoryTest.querying an old predicate does not resurrect its cross-key predecessor' "-Pkairo.testTempDir=$testTemp" '-Pkotlin.compiler.execution.strategy=in-process' --no-daemon --console=plain
```

Result: `BUILD SUCCESSFUL`, 1 test, 0 failures.

Focused repository suite:

```powershell
.\gradlew.bat :platform:android:testDebugUnitTest --tests 'kairo.platform.db.RoomKnowledgeRepositoryTest' "-Pkairo.testTempDir=$testTemp" '-Pkotlin.compiler.execution.strategy=in-process' --no-daemon --console=plain
```

Result: `BUILD SUCCESSFUL`, 9 repository tests, 0 failures.

Full verification:

```powershell
.\gradlew.bat :core:domain:test :platform:android:testDebugUnitTest :platform:android:compileDebugAndroidTestKotlin verifyContracts "-Pkairo.testTempDir=$testTemp" '-Pkotlin.compiler.execution.strategy=in-process' --no-daemon --console=plain
```

Result: `BUILD SUCCESSFUL`.

- Domain: 36 tests, 0 failures/errors.
- Android JVM: 10 tests, 0 failures/errors (9 repository tests plus 1 JVM migration test).
- Root contracts: 12 tests, 12 passed.
- Instrumentation migration source: compiled successfully; no connected-device execution was claimed.

```powershell
git diff --check
```

Result: exit 0; no whitespace errors, with only the existing Windows LF-to-CRLF advisory.

### Changed files

- `platform/android/src/main/kotlin/kairo/platform/db/KairoDatabase.kt`
- `platform/android/src/main/kotlin/kairo/platform/db/RoomKnowledgeRepository.kt`
- `platform/android/src/test/kotlin/kairo/platform/db/RoomKnowledgeRepositoryTest.kt`
- `.superpowers/sdd/2026-08-20-kairo-v1-implementation/task-4-report.md`

### Self-review and mutation check

- Restoring DAO prefiltering would make the new old-key assertion fail by resurrecting the predecessor.
- Filtering projected results incorrectly would make either the old-key empty assertion or the new-key successor assertion fail.
- The implementation continues to use the reviewed domain ranking/retirement model; it adds no competing persistence ranking.
- Query results remain defensive immutable snapshots after the new post-projection filter.
- Schema version and migration DDL are unchanged by this repository-only semantic correction.

### Fix commit

- `fix: preserve cross-key fact supersession` (local only; not pushed)
