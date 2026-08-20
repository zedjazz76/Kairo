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
