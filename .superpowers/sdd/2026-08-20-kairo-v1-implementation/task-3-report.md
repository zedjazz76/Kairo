# Task 3 report — provenance-rich contextual domain records

## Status

Complete. The domain now models immutable provenance-rich sources and source
variants, multi-artifact Capture Sessions and candidates, distinct Radiology
Workflow temporal states, project architecture context, and reusable incident
patterns. No production system state is overwritten by planned project
knowledge.

## TDD evidence

### RED

Before any Task 3 production files existed, the following focused command was
run with the workspace-local JDK 17 and cache:

```powershell
$env:JAVA_HOME = (Resolve-Path '..\\..\\work\\toolchains\\temurin17\\PFiles64\\Eclipse Adoptium\\jdk-17.0.20.8-hotspot').Path
$env:GRADLE_USER_HOME = (Resolve-Path 'work\\gradle-user-home').Path
.\\gradlew.bat --offline --no-daemon :core:domain:test --tests "*ContextDomainTest"
```

Result: exit 1 at `:core:domain:compileTestKotlin`, with the intended
unresolved domain references including `SourceAnchor`, `SourceId`,
`SourceVariantId`, `AnchorLocator`, `CaptureSession`, `CaptureCandidate`,
`WorkflowState`, `Workflow`, `Project`, and `ProjectTimeline`.

The sandbox denied Kotlin's local daemon marker; Gradle used its successful
in-process compiler fallback before reaching the intended unresolved-type RED.

### GREEN

The same focused command passed after implementation: 5 ContextDomainTest
tests completed with no failures.

The full domain command passed:

```powershell
.\\gradlew.bat --offline --no-daemon :core:domain:test
```

The root contract gate also passed with the bundled Node and pnpm runtime
directories prepended to `PATH`:

```powershell
.\\gradlew.bat --offline --no-daemon verifyContracts
```

Result: 12 contract tests passed; zero failed, skipped, or cancelled.

## Behavior covered

- A candidate from a multi-artifact Capture Session retains every contributing
  PDF and sheet anchor.
- A current breast/mammography Merge RIS workflow remains `CURRENT` in
  `MANA_PRODUCTION`; the planned non-breast AbbaDox CareFlow RIS workflow is
  separately `FUTURE` in `PROJECT` scope.
- The February 2027 breast/Merge RIS continuation is represented as
  project-scoped `PLANNED` `FactVersion` knowledge and is not projected as
  current production understanding.
- A Project rejects a MANA-production-scoped fact in its project knowledge.
- Context-domain collection fields are defensive unmodifiable snapshots.

## Changed files

- `core/domain/src/main/kotlin/kairo/domain/Source.kt`
- `core/domain/src/main/kotlin/kairo/domain/CaptureSession.kt`
- `core/domain/src/main/kotlin/kairo/domain/Workflow.kt`
- `core/domain/src/main/kotlin/kairo/domain/Project.kt`
- `core/domain/src/main/kotlin/kairo/domain/Incident.kt`
- `core/domain/src/test/kotlin/kairo/domain/ContextDomainTest.kt`
- `.superpowers/sdd/2026-08-20-kairo-v1-implementation/task-3-report.md`

## Self-review

- Reviewed the complete six-file domain/test diff (670 added lines before this
  report) and ran `git diff --check`; no whitespace errors were reported.
- Source metadata contains origin, type, hashes, import time, classification,
  version lineage, extraction status, variants, and typed anchors. It contains
  no source blob.
- Anchor locators provide validated `PdfPageBox`, `ImageRegion`, `SheetRange`,
  `TextSpan`, and `ChatTurn` variants.
- Project architecture lists validate and preserve `CURRENT`, `TRANSITION`,
  `FUTURE`, and `HISTORICAL` workflows independently. Project facts are
  explicitly limited to `PROJECT` scope.
- There is no cardiology terminology, persistence, Room, ingestion, retrieval,
  PHI scanning, or UI work in this change.

## Commit

- `feat: model sources workflows projects and incidents` (local only; not
  pushed)

## Concerns

- Gradle emits pre-existing deprecation notices for Gradle 10 compatibility.
- The sandbox prevents Kotlin daemon marker creation under the user profile;
  all requested Kotlin verification succeeded with Gradle's in-process fallback.

---

## Fix round 1 — provenance and contextual integrity

### Status

Complete. The contextual records now reject incoherent source lineage and
unattributed candidates, keep Project architectures exclusively project scoped,
enforce Project identifier and meeting integrity, require anchors for confirmed
or observed workflow records, and preserve the full locked Project lifecycle.

### RED

Before changing the Task 3 production records, the focused command was run:

```powershell
.\\gradlew.bat --offline --no-daemon :core:domain:test --tests "*ContextDomainTest"
```

Result: exit 1 at `:core:domain:compileTestKotlin` after the known Kotlin
in-process fallback. The seven intended failures were four unresolved
`CaptureCandidate.from` references and three unresolved
`ProjectStatus.IMPLEMENTATION` references. These tests specified the new
session-bound candidate API and the locked lifecycle before implementation.

### GREEN

- Focused `ContextDomainTest`: passed after the fixes.
- `:core:domain:test`: passed.
- `verifyContracts`: passed with 12 passing contract tests and zero failures.
- `git diff --check`: passed.

### Regression coverage

- Valid source roots match top-level hash/import metadata and retain exactly
  the union of their variant anchors; dangling/self parents, duplicate version
  numbers, top-level metadata mismatch, and omitted retained anchors are
  rejected.
- `CaptureCandidate.from` accepts only anchors held by the supplied
  `CaptureSession`; direct candidate construction is private.
- Project architecture rejects MANA-production-scoped workflows, duplicate
  workflow IDs across temporal lists, duplicate fact/decision/risk/question/
  action IDs, and meetings without a retained Capture Session reference.
- Confirmed/observed workflows and steps reject empty source anchors.
- `ProjectStatus` exactly contains IDEA, DISCOVERY, PLANNING,
  IMPLEMENTATION, VALIDATION, GO_LIVE, HYPERCARE, COMPLETED, and HISTORICAL.

### Changed files

- `core/domain/src/main/kotlin/kairo/domain/Source.kt`
- `core/domain/src/main/kotlin/kairo/domain/CaptureSession.kt`
- `core/domain/src/main/kotlin/kairo/domain/Workflow.kt`
- `core/domain/src/main/kotlin/kairo/domain/Project.kt`
- `core/domain/src/test/kotlin/kairo/domain/ContextDomainTest.kt`
- `.superpowers/sdd/2026-08-20-kairo-v1-implementation/task-3-report.md`

### Self-review

- Reviewed the focused five-file production/test diff. The source root
  requirement is deterministic, parent versions must be earlier, and no
  source anchor can point to an omitted retained variant because the top-level
  anchor set must equal the variant-anchor union.
- The factory boundary binds candidate `captureSessionId` from the actual
  session object and checks every submitted anchor against that session.
- Project architecture remains a context for project-scoped design; independent
  MANA current workflows remain representable outside a Project.
- No cardiology terminology or deferred persistence, ingestion, retrieval,
  UI, or PHI-scanning scope was introduced. The controller-deferred value-
  equality concern was not widened.

### Commit

- `fix: enforce contextual provenance boundaries` (local only; not pushed).

### Concerns

- Existing Gradle 10 deprecation notices remain.
- The sandbox Kotlin-daemon marker restriction remains environmental; all
  requested checks completed through the successful in-process fallback.
