# Kairo V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable Kairo release: an Android-hosted, evidence-backed clinical-systems knowledge Core with offline Android access, a secure browser desktop client, universal modern artifact capture, controlled memory promotion, hybrid retrieval, Quick and Deep Analyze, and source-linked answers.

**Architecture:** One authoritative Kairo Core initially runs inside Android behind versioned capability interfaces. The browser desktop reaches that Core through an authenticated, ephemeral, end-to-end-encrypted relay tunnel; the relay routes ciphertext and model requests but stores no Kairo corpus. Room/SQLite and an immutable encrypted Source Vault are authoritative, while lexical and semantic indexes are rebuildable derivatives.

**Tech Stack:** Kotlin, Jetpack Compose, Room/SQLite, WorkManager, AppSearch LocalStorage, Android Keystore, ML Kit OCR, Apache PDFBox Android, Apache POI, Kotlin serialization, OkHttp WebSocket, TypeScript, React, Vite, Web Crypto, Fastify, WebSocket, JSON Schema/OpenAPI, JUnit, Android instrumented tests, Vitest, and Playwright.

**Spec:** `docs/superpowers/specs/2026-08-20-kairo-design.md`

## Global Constraints

- Kairo is advisory-only and must never perform production clinical-system writes.
- Kairo Core owns durable knowledge; V1 has exactly one authoritative Core at a time.
- Android is the initial physical Core host and must retain meaningful offline browsing, search, workflows, projects, source reading, and memory review.
- Desktop is browser-based and requires no administrator installation.
- The relay stores no permanent Kairo knowledge, sources, prompts, screenshots, conversations, or memory.
- Provider secrets never exist in the Android APK or browser bundle.
- Possible PHI is detected locally before durable promotion or cloud reasoning; Temporary Use data stays out of facts, embeddings, normal backups, and ordinary source retention.
- Original durable sources are immutable; redactions and extraction outputs are explicit derivatives.
- Product/MANA, project/production, and current/planned scopes are enforced in persistence and retrieval, not only in prompts.
- Important facts are append-versioned and retain evidence, reality time, knowledge time, conflicts, and prior states.
- AI output enters durable memory only through Memory Inbox review.
- Modern V1 formats are PDF, scanned PDF, DOCX, XLSX, CSV, TXT, Markdown, PNG, JPG/JPEG, screenshots, and pasted text. PPTX is included only after all launch-blocking formats pass.
- Do not add multi-user collaboration, enterprise RBAC/SSO, bidirectional multi-device sync, native desktop installation, production automation, or live external connectors.
- Use TDD for every behavior change, preserve focused files, and commit after each task passes its stated verification.

## File and module map

```text
kairo/
├── apps/
│   ├── android/                 Compose UI, Android Core host, Room, vault, offline indexes
│   └── desktop-web/             Browser capture, Copilot, evidence, projects, Memory Inbox
├── core/
│   ├── domain/                  Pure Kotlin entities, facts, scopes, time, workflows, projects
│   ├── application/             Capability interfaces and use cases
│   ├── ingestion/               Normalization, extraction, OCR orchestration, candidate creation
│   ├── retrieval/               Structured, lexical, semantic, ranking, reasoning packets
│   └── security/                PHI/credential policy and redaction contracts
├── platform/
│   └── android/                 Room repositories, Source Vault, WorkManager, AppSearch, ML Kit
├── relay/                       Stateless pairing/tunnel and model-provider gateway
├── shared/
│   └── contracts/               Versioned JSON Schema and OpenAPI contracts
├── validation/                  Private fixture manifest, benchmark questions, expected results
├── docs/decisions/              ADRs made during execution
└── docs/superpowers/            Locked spec and this plan
```

The pure Kotlin Core must not import Android UI or persistence classes. TypeScript clients consume generated JSON types from `shared/contracts`; they do not duplicate contract shapes manually.

---

### Task 1: Bootstrap the monorepo and lock executable contracts

**Files:**
- Create: `settings.gradle.kts`, `build.gradle.kts`, `gradle/libs.versions.toml`
- Create: `package.json`, `pnpm-workspace.yaml`
- Create: `shared/contracts/schemas/kairo-answer.v1.json`
- Create: `shared/contracts/schemas/core-command.v1.json`
- Create: `shared/contracts/openapi/kairo-relay.v1.yaml`
- Create: `shared/contracts/tests/contracts.test.ts`
- Create: `.github/workflows/ci.yml`, `.gitignore`, `README.md`
- Create: `docs/decisions/ADR-0001-initial-core-host.md`

**Interfaces:**
- Consumes: the locked design specification.
- Produces: `CoreCommandV1`, `CoreResultV1`, `KairoAnswerV1`, relay pairing/tunnel endpoints, and reproducible root build commands.

- [ ] **Step 1: Write failing schema tests**

```ts
it("rejects an answer claim without scope, state, or evidence", () => {
  const answer = { assessment: "PACS hosts DMWL", claims: [{ text: "PACS hosts DMWL" }] };
  expect(validateKairoAnswer(answer).valid).toBe(false);
});
```

- [ ] **Step 2: Run the test and verify the missing workspace/contracts fail**

Run: `pnpm install --frozen-lockfile && pnpm test --filter @kairo/contracts`  
Expected: FAIL because the workspace and schema validator do not exist.

- [ ] **Step 3: Add minimal workspace files and contracts**

Define `KairoAnswerV1` so every claim requires `scope`, `evidenceState`, and `evidenceRefs`; define command envelopes with `requestId`, `type`, `contractVersion`, and `payload`. ADR-0001 records: Android hosts the first authoritative Core; desktop access uses an ephemeral encrypted relay tunnel; there is no second writable graph.

```json
{
  "text": "Merge PACS hosts DMWL",
  "scope": "MANA_PRODUCTION",
  "evidenceState": "CONFIRMED",
  "evidenceRefs": ["evidence-1"]
}
```

- [ ] **Step 4: Run contract tests and both build entry points**

Run: `pnpm test --filter @kairo/contracts`  
Run: `.\gradlew.bat tasks`  
Expected: PASS and Gradle exits 0.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: bootstrap Kairo monorepo and contracts"
```

### Task 2: Implement the evidence-backed temporal domain Core

**Files:**
- Create: `core/domain/src/main/kotlin/kairo/domain/Knowledge.kt`
- Create: `core/domain/src/main/kotlin/kairo/domain/Fact.kt`
- Create: `core/domain/src/main/kotlin/kairo/domain/Evidence.kt`
- Create: `core/domain/src/main/kotlin/kairo/domain/TemporalProjection.kt`
- Test: `core/domain/src/test/kotlin/kairo/domain/TemporalProjectionTest.kt`

**Interfaces:**
- Consumes: contract enum names from Task 1.
- Produces: `EntityId`, `FactId`, `EvidenceRef`, `KnowledgeScope`, `EvidenceState`, `FactVersion`, and `CurrentBestUnderstanding.project()`.

- [ ] **Step 1: Write failing temporal and scope tests**

```kotlin
@Test fun `planned project fact never replaces confirmed production fact`() {
    val result = CurrentBestUnderstanding.project(listOf(confirmedProduction, plannedProject))
    assertEquals(confirmedProduction.id, result.single().id)
    assertTrue(result.history.contains(plannedProject))
}

@Test fun `later contradiction preserves both versions`() {
    val result = CurrentBestUnderstanding.project(listOf(oldFact, contradictedRevision))
    assertEquals(EvidenceState.CONTRADICTED, result.history.last().state)
    assertEquals(2, result.history.size)
}
```

- [ ] **Step 2: Verify the tests fail**

Run: `.\gradlew.bat :core:domain:test --tests "*TemporalProjectionTest"`  
Expected: FAIL because the domain types and projection do not exist.

- [ ] **Step 3: Implement immutable domain records and projection rules**

```kotlin
data class FactVersion(
    val id: FactId,
    val subject: EntityId,
    val predicate: String,
    val objectValue: FactObject,
    val scope: KnowledgeScope,
    val state: EvidenceState,
    val effectiveFrom: Instant?,
    val effectiveTo: Instant?,
    val recordedAt: Instant,
    val lastValidatedAt: Instant?,
    val evidence: Set<EvidenceRef>,
    val supersedes: FactId? = null
)
```

Reject important active facts with no evidence; retain machine extraction scores separately from the user-facing evidence state.

- [ ] **Step 4: Run domain tests**

Run: `.\gradlew.bat :core:domain:test`  
Expected: PASS with temporal, conflict, evidence, and scope tests green.

- [ ] **Step 5: Commit**

```bash
git add core/domain
git commit -m "feat: add temporal evidence domain core"
```

### Task 3: Add sources, Capture Sessions, workflows, projects, and incidents

**Files:**
- Create: `core/domain/src/main/kotlin/kairo/domain/Source.kt`
- Create: `core/domain/src/main/kotlin/kairo/domain/CaptureSession.kt`
- Create: `core/domain/src/main/kotlin/kairo/domain/Workflow.kt`
- Create: `core/domain/src/main/kotlin/kairo/domain/Project.kt`
- Create: `core/domain/src/main/kotlin/kairo/domain/Incident.kt`
- Test: `core/domain/src/test/kotlin/kairo/domain/ContextDomainTest.kt`

**Interfaces:**
- Consumes: identifiers, scopes, time, and evidence from Task 2.
- Produces: `Source`, `SourceVariant`, `SourceAnchor`, `CaptureSession`, `Workflow`, `WorkflowStep`, `Project`, `Decision`, `Risk`, `OpenQuestion`, `ActionItem`, and `IncidentPattern`.

- [ ] **Step 1: Write failing provenance and temporal-workflow tests**

```kotlin
@Test fun `candidate from batch retains every contributing anchor`() {
    assertEquals(setOf(pdfAnchor, sheetAnchor), candidate.evidenceAnchors)
}

@Test fun `future non breast workflow does not replace current breast workflow`() {
    assertEquals(WorkflowState.CURRENT, breastCurrent.state)
    assertEquals(WorkflowState.FUTURE, nonBreastFuture.state)
    assertNotEquals(breastCurrent.scope, nonBreastFuture.scope)
}
```

- [ ] **Step 2: Verify the tests fail**

Run: `.\gradlew.bat :core:domain:test --tests "*ContextDomainTest"`  
Expected: FAIL with unresolved domain types.

- [ ] **Step 3: Implement focused immutable records**

```kotlin
data class SourceAnchor(
    val sourceId: SourceId,
    val variantId: SourceVariantId,
    val locator: AnchorLocator // PdfPageBox, ImageRegion, SheetRange, TextSpan, ChatTurn
)
```

Represent the February 2027 breast/Merge RIS continuation as a project-scoped `PLANNED` fact until production validation changes its state. Store current, transition, future, and historical workflows separately.

- [ ] **Step 4: Run all domain tests**

Run: `.\gradlew.bat :core:domain:test`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add core/domain
git commit -m "feat: model sources workflows projects and incidents"
```

### Task 4: Persist the authoritative Core with Room and migration safety

**Files:**
- Create: `core/application/src/main/kotlin/kairo/application/KnowledgeRepository.kt`
- Create: `platform/android/src/main/kotlin/kairo/platform/db/KairoDatabase.kt`
- Create: `platform/android/src/main/kotlin/kairo/platform/db/KnowledgeEntities.kt`
- Create: `platform/android/src/main/kotlin/kairo/platform/db/RoomKnowledgeRepository.kt`
- Test: `platform/android/src/androidTest/kotlin/kairo/platform/db/KnowledgeMigrationTest.kt`

**Interfaces:**
- Consumes: domain records from Tasks 2–3.
- Produces: `KnowledgeRepository.appendFactVersion()`, `currentUnderstanding()`, `history()`, `saveSource()`, `saveCaptureSession()`, and transactional audit events.

- [ ] **Step 1: Write failing repository contract and migration tests**

```kotlin
@Test fun append_does_not_update_existing_fact_row() = runTest {
    repository.appendFactVersion(v1)
    repository.appendFactVersion(v2.copy(supersedes = v1.id))
    assertEquals(listOf(v1, v2), repository.history(v1.lineageId))
}
```

The migration fixture must assert facts, evidence links, source hashes, scopes, and audit events survive schema upgrade.

- [ ] **Step 2: Verify tests fail**

Run: `.\gradlew.bat :platform:android:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=kairo.platform.db.KnowledgeMigrationTest`  
Expected: FAIL because the database and repository do not exist.

- [ ] **Step 3: Implement normalized Room tables and repository mapping**

Use transactions for fact version + evidence links + audit event. Add unique constraints for source hash identity and indexes for subject/predicate/object, scope/project, state, effective time, recorded time, and lineage.

```kotlin
interface KnowledgeRepository {
    suspend fun appendFactVersion(fact: FactVersion, audit: AuditEvent)
    suspend fun currentUnderstanding(query: FactQuery): List<FactVersion>
    suspend fun history(lineageId: FactLineageId): List<FactVersion>
}
```

- [ ] **Step 4: Run repository and migration suites**

Run: `.\gradlew.bat :platform:android:testDebugUnitTest :platform:android:connectedDebugAndroidTest`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add core/application platform/android
git commit -m "feat: persist authoritative evidence graph with Room"
```

### Task 5: Implement encrypted immutable Source Vault and PHI/session guard

**Files:**
- Create: `core/security/src/main/kotlin/kairo/security/SensitiveContentPolicy.kt`
- Create: `platform/android/src/main/kotlin/kairo/platform/vault/SourceVault.kt`
- Create: `platform/android/src/main/kotlin/kairo/platform/vault/EncryptedSourceVault.kt`
- Create: `platform/android/src/main/kotlin/kairo/platform/vault/KairoArchive.kt`
- Create: `platform/android/src/main/kotlin/kairo/platform/security/LocalSensitiveContentScanner.kt`
- Test: `platform/android/src/test/kotlin/kairo/platform/vault/SourceVaultTest.kt`
- Test: `platform/android/src/test/kotlin/kairo/platform/security/SensitiveContentScannerTest.kt`

**Interfaces:**
- Consumes: `Source`, `SourceVariant`, and anchors.
- Produces: `SourceVault.importDurable()`, `createDerivative()`, `open()`, `KairoArchive.exportEncrypted()`, `importEncrypted()`, `SensitiveContentDecision`, and `TemporarySessionStore.clear()`.

- [ ] **Step 1: Write failing hash, immutability, and boundary tests**

```kotlin
@Test fun `same bytes share blob but retain import records`() = runTest {
    val first = vault.importDurable(bytes, metadataA)
    val second = vault.importDurable(bytes, metadataB)
    assertEquals(first.contentHash, second.contentHash)
    assertNotEquals(first.importId, second.importId)
}

@Test fun `temporary PHI is excluded from durable vault and embedding queue`() {
    assertEquals(StorageDisposition.TEMPORARY_ONLY, policy.decide(scanWithMrn, TEMPORARY_USE))
}

@Test fun `encrypted archive round trip preserves evidence and excludes temporary sessions`() = runTest {
    val restored = archive.importEncrypted(archive.exportEncrypted(passphrase))
    assertEquals(durableEvidenceIds, restored.evidenceIds)
    assertTrue(restored.temporarySessionIds.isEmpty())
}
```

- [ ] **Step 2: Verify tests fail**

Run: `.\gradlew.bat :platform:android:testDebugUnitTest --tests "*SourceVaultTest" --tests "*SensitiveContentScannerTest"`  
Expected: FAIL.

- [ ] **Step 3: Implement AES-GCM vault encryption and local scan policy**

Use an Android Keystore-wrapped master key, SHA-256 content addressing, authenticated metadata, immutable originals, explicit redacted derivatives, and a separate cache-backed temporary session store. Encrypted archives use a passphrase-derived wrapping key, authenticated manifest, per-object hashes, and an atomic validate-then-import transaction; they exclude temporary sessions. Detect names/patient-label patterns, MRN/accession/order/DOB/Study UID patterns, API keys, tokens, private keys, URLs containing credentials, and connection strings.

```kotlin
enum class UserSensitiveChoice { REDACT, TEMPORARY_USE, CANCEL }
sealed interface StorageDisposition { data object Durable : StorageDisposition; data object TemporaryOnly : StorageDisposition; data object Rejected : StorageDisposition }
```

- [ ] **Step 4: Run vault/security tests and confirm temporary cleanup**

Run: `.\gradlew.bat :platform:android:testDebugUnitTest`  
Expected: PASS, including a process-restart test showing the temporary store is clearable and absent from backup manifests.

- [ ] **Step 5: Commit**

```bash
git add core/security platform/android
git commit -m "feat: add encrypted source vault and PHI boundary"
```

### Task 6: Build resumable universal artifact ingestion

**Files:**
- Create: `core/ingestion/src/main/kotlin/kairo/ingestion/IngestionPipeline.kt`
- Create: `core/ingestion/src/main/kotlin/kairo/ingestion/ArtifactExtractor.kt`
- Create: `platform/android/src/main/kotlin/kairo/platform/ingestion/IngestionWorker.kt`
- Create: `platform/android/src/main/kotlin/kairo/platform/ingestion/extractors/{Pdf,Docx,Xlsx,Csv,Text,Image}Extractor.kt`
- Test: `core/ingestion/src/test/kotlin/kairo/ingestion/IngestionPipelineTest.kt`
- Test fixtures: `validation/fixtures/ingestion/`

**Interfaces:**
- Consumes: Capture Sessions, Vault, sensitive-content policy, repository.
- Produces: `IngestionPipeline.enqueue(sessionId)`, resumable `IngestionStage`, `ExtractedArtifact`, structural anchors, and evidence-linked `MemoryCandidateDraft` records.

- [ ] **Step 1: Write failing format and resume tests**

```kotlin
@Test fun `batch analysis preserves cross artifact context and source anchors`() = runTest {
    val result = pipeline.run(sessionWithDocxPdfPngXlsx)
    assertTrue(result.candidates.any { it.subjectLabel == "AbbaDox" })
    assertTrue(result.candidates.all { it.evidenceAnchors.isNotEmpty() })
}

@Test fun `pipeline resumes at failed stage`() = runTest {
    pipeline.runUntil(sessionId, IngestionStage.OCR_COMPLETE)
    assertEquals(IngestionStage.PHI_REVIEW_REQUIRED, pipeline.resume(sessionId).nextStage)
}
```

- [ ] **Step 2: Verify tests fail**

Run: `.\gradlew.bat :core:ingestion:test --tests "*IngestionPipelineTest"`  
Expected: FAIL.

- [ ] **Step 3: Implement idempotent stages and required extractors**

```kotlin
enum class IngestionStage {
    IMPORTED, HASHED, EXTRACTED, OCR_COMPLETE, PHI_REVIEW_REQUIRED,
    INDEXED, ANALYZED, CANDIDATES_CREATED, COMPLETE
}
```

PDF extraction preserves pages, headings, tables, and bounding boxes where available; scanned pages route through OCR. DOCX preserves headings/tables, XLSX/CSV preserve sheets/ranges/rows, text preserves spans, and images preserve OCR regions. WorkManager chains stages and retries only idempotent operations.

- [ ] **Step 4: Run ingestion tests over every launch-blocking fixture**

Run: `.\gradlew.bat :core:ingestion:test :platform:android:testDebugUnitTest`  
Expected: PASS for PDF, scanned PDF, DOCX, XLSX, CSV, TXT, Markdown, PNG, JPG, pasted text, batch context, exact deduplication, cancellation, and resume.

- [ ] **Step 5: Commit**

```bash
git add core/ingestion platform/android validation/fixtures/ingestion
git commit -m "feat: ingest modern knowledge artifacts resumably"
```

### Task 7: Implement Memory Inbox and controlled promotion

**Files:**
- Create: `core/application/src/main/kotlin/kairo/application/MemoryInboxService.kt`
- Create: `apps/android/src/main/kotlin/kairo/android/memory/MemoryInboxScreen.kt`
- Test: `core/application/src/test/kotlin/kairo/application/MemoryInboxServiceTest.kt`
- Test: `apps/android/src/androidTest/kotlin/kairo/android/memory/MemoryInboxScreenTest.kt`

**Interfaces:**
- Consumes: `MemoryCandidateDraft`, repository, audit events.
- Produces: `approve()`, `editAndApprove()`, `reject()`, `defer()`, and `MemoryDecision`.

- [ ] **Step 1: Write failing promotion tests**

```kotlin
@Test fun `AI candidate cannot become active without human decision`() = runTest {
    service.receive(aiCandidate)
    assertTrue(repository.currentUnderstanding(query).isEmpty())
    service.approve(aiCandidate.id, reviewer = UserId.LOCAL_OWNER)
    assertEquals(1, repository.currentUnderstanding(query).size)
}
```

- [ ] **Step 2: Verify tests fail**

Run: `.\gradlew.bat :core:application:test --tests "*MemoryInboxServiceTest"`  
Expected: FAIL.

- [ ] **Step 3: Implement service and fast review UI**

Approve appends an active fact version and audit event; edit-and-approve preserves the original candidate; reject and defer retain decision history without creating a fact. The UI shows claim, scope, evidence state, source anchors, detected sensitivity, and Approve/Edit/Reject/Defer actions.

- [ ] **Step 4: Run service and UI tests**

Run: `.\gradlew.bat :core:application:test :apps:android:connectedDebugAndroidTest`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add core/application apps/android
git commit -m "feat: add controlled Memory Inbox promotion"
```

### Task 8: Add structured, lexical, and semantic retrieval with evidence ranking

**Files:**
- Create: `core/retrieval/src/main/kotlin/kairo/retrieval/HybridRetriever.kt`
- Create: `core/retrieval/src/main/kotlin/kairo/retrieval/EvidenceRanker.kt`
- Create: `platform/android/src/main/kotlin/kairo/platform/search/AppSearchIndex.kt`
- Create: `platform/android/src/main/kotlin/kairo/platform/search/EmbeddingIndex.kt`
- Test: `core/retrieval/src/test/kotlin/kairo/retrieval/HybridRetrieverTest.kt`

**Interfaces:**
- Consumes: repository, source segments, workflows, projects, incidents.
- Produces: `HybridRetriever.retrieve(RetrievalQuery): EvidenceBundle` and rebuildable `LexicalIndex`/`SemanticIndex` ports.

- [ ] **Step 1: Write failing benchmark retrieval tests**

```kotlin
@Test fun `MANA production evidence outranks vendor capability`() = runTest {
    val bundle = retriever.retrieve(RetrievalQuery("Who hosts DMWL?", manaScope))
    assertEquals(productionFact.id, bundle.rankedClaims.first().fact.id)
}

@Test fun `semantic query retrieves breast routing incident without exact phrase`() = runTest {
    val bundle = retriever.retrieve(RetrievalQuery("studies failing to reach interpretation", manaScope))
    assertTrue(bundle.incidents.contains(magViewRoutingIncident))
}
```

- [ ] **Step 2: Verify tests fail**

Run: `.\gradlew.bat :core:retrieval:test --tests "*HybridRetrieverTest"`  
Expected: FAIL.

- [ ] **Step 3: Implement layered retrieval and deterministic ranking**

Rank by scope match, evidence authority, evidence state, corroboration, temporal applicability, and lexical/semantic relevance. Graph expansion narrows semantic candidates. Store embedding model/version/dimension/quantization/content hash; reject mixed incompatible indexes.

```kotlin
data class EvidenceBundle(
    val entities: List<Entity>, val rankedClaims: List<RankedFact>,
    val sources: List<SourceExcerpt>, val workflows: List<Workflow>,
    val projects: List<Project>, val incidents: List<IncidentPattern>,
    val conflicts: List<ConflictExplanation>, val unknowns: List<String>
)
```

- [ ] **Step 4: Run retrieval tests and rebuild-index test**

Run: `.\gradlew.bat :core:retrieval:test :platform:android:testDebugUnitTest`  
Expected: PASS; deleting both derived indexes and rebuilding produces equivalent benchmark results.

- [ ] **Step 5: Commit**

```bash
git add core/retrieval platform/android
git commit -m "feat: add hybrid evidence retrieval"
```

### Task 9: Implement Quick answers, Model Gateway, and hallucination firewall

**Files:**
- Create: `core/application/src/main/kotlin/kairo/application/AskKairoService.kt`
- Create: `core/application/src/main/kotlin/kairo/application/ReasoningProvider.kt`
- Create: `core/application/src/main/kotlin/kairo/application/AnswerValidator.kt`
- Create: `relay/src/model/ModelGateway.ts`
- Create: `relay/src/model/providers/OpenAIProvider.ts`
- Test: `core/application/src/test/kotlin/kairo/application/AskKairoServiceTest.kt`
- Test: `relay/test/model-gateway.test.ts`

**Interfaces:**
- Consumes: `EvidenceBundle`, `KairoAnswerV1` schema.
- Produces: `AskKairoService.quick()`, `ReasoningProvider.analyze()`, and validated `KairoAnswer`.

- [ ] **Step 1: Write failing evidence-compliance tests**

```kotlin
@Test fun `unsupported MANA claim is rejected`() {
    val result = validator.validate(modelAnswerWithoutEvidence, bundle)
    assertTrue(result is ValidationResult.Rejected)
}

@Test fun `simple fact lookup does not require frontier model`() = runTest {
    service.quick("What version of Merge RIS do we use?")
    verify(exactly = 0) { reasoningProvider.analyze(any()) }
}
```

- [ ] **Step 2: Verify tests fail**

Run: `.\gradlew.bat :core:application:test --tests "*AskKairoServiceTest"`  
Run: `pnpm --filter @kairo/relay test`  
Expected: FAIL.

- [ ] **Step 3: Implement local Quick rendering and provider abstraction**

Build compact reasoning packets containing confirmed, observed, planned, product, hypothesis, unknown, and prohibited-action context. Validate claim evidence refs against the retrieved bundle, scope and time against the repository, temporary identifiers against policy, and recommendations against the advisory-only boundary.

```kotlin
interface ReasoningProvider {
    suspend fun analyze(packet: ReasoningPacket): KairoAnswer
    suspend fun visionAnalyze(packet: VisionPacket): VisionObservationSet
}
```

Provider credentials exist only in relay environment configuration. Do not log request bodies.

- [ ] **Step 4: Run Core and relay tests**

Run: `.\gradlew.bat :core:application:test`  
Run: `pnpm --filter @kairo/relay test`  
Expected: PASS, including unknown-answer, product/MANA separation, temporary-identifier, and prohibited-action cases.

- [ ] **Step 5: Commit**

```bash
git add core/application relay
git commit -m "feat: add evidence validated Kairo answers"
```

### Task 10: Implement Deep Analyze and Trace workflow

**Files:**
- Create: `core/application/src/main/kotlin/kairo/application/DeepAnalyzeService.kt`
- Create: `core/application/src/main/kotlin/kairo/application/TraceWorkflowService.kt`
- Test: `core/application/src/test/kotlin/kairo/application/DeepAnalyzeServiceTest.kt`
- Test: `core/application/src/test/kotlin/kairo/application/TraceWorkflowServiceTest.kt`

**Interfaces:**
- Consumes: hybrid retrieval, model gateway, workflows, incidents, projects.
- Produces: `deepAnalyze(question)`, `trace(workflowId, atTime, knowledgeAsOf)`, ranked failure domains, and next-best validation action.

- [ ] **Step 1: Write failing MANA temporal and diagnostic tests**

```kotlin
@Test fun `trace distinguishes current from AbbaDox future state`() = runTest {
    assertTrue(trace.current.steps.any { it.system == MERGE_RIS })
    assertTrue(trace.future.steps.any { it.system == ABBADOX })
    assertTrue(trace.future.annotations.contains("Breast remains on Merge RIS through approximately February 2027 (planned)"))
}

@Test fun `deep analysis ranks a failure domain and a next verification`() = runTest {
    val result = service.deepAnalyze("Why are studies not reaching MagView?")
    assertTrue(result.failureDomains.isNotEmpty())
    assertNotNull(result.nextBestAction)
    assertTrue(result.claims.all { it.evidenceRefs.isNotEmpty() || it.state == HYPOTHESIS })
}
```

- [ ] **Step 2: Verify tests fail**

Run: `.\gradlew.bat :core:application:test --tests "*DeepAnalyzeServiceTest" --tests "*TraceWorkflowServiceTest"`  
Expected: FAIL.

- [ ] **Step 3: Implement expanded retrieval and time-aware Trace**

Deep Analyze expands graph depth, sources, incidents, conflicts, and project context before the strongest configured model call. Trace supports effective-time and knowledge-as-of queries, identifier mappings, evidence state per hop, failure domains per step, and unknown hops.

- [ ] **Step 4: Run service and workflow benchmark tests**

Run: `.\gradlew.bat :core:application:test :core:retrieval:test`  
Expected: PASS for breast current state, AbbaDox non-breast future state, and Baxter identity/result flow fixtures.

- [ ] **Step 5: Commit**

```bash
git add core/application
git commit -m "feat: add Deep Analyze and temporal Trace"
```

### Task 11: Build the Android V1 experience and offline boundary

**Files:**
- Create: `apps/android/src/main/kotlin/kairo/android/KairoApplication.kt`
- Create: `apps/android/src/main/kotlin/kairo/android/navigation/KairoNavGraph.kt`
- Create: `apps/android/src/main/kotlin/kairo/android/copilot/CopilotScreen.kt`
- Create: `apps/android/src/main/kotlin/kairo/android/{systems,workflows,projects,knowledge,capture,sources}/`
- Create: `apps/android/src/main/kotlin/kairo/android/offline/ConnectivityCapability.kt`
- Create: `apps/android/src/main/kotlin/kairo/android/security/AppUnlockGate.kt`
- Test: `apps/android/src/androidTest/kotlin/kairo/android/KairoNavigationTest.kt`
- Test: `apps/android/src/androidTest/kotlin/kairo/android/OfflineCapabilityTest.kt`
- Test: `apps/android/src/androidTest/kotlin/kairo/android/AppUnlockGateTest.kt`

**Interfaces:**
- Consumes: all Core capability interfaces from Tasks 4–10.
- Produces: Copilot, Systems, Workflows, Projects, Knowledge, Capture, Sources, Memory Inbox, Quick, Deep Analyze, and evidence navigation UI.

- [ ] **Step 1: Write failing navigation and offline tests**

```kotlin
@Test fun offline_mode_keeps_local_capabilities_and_disables_cloud_actions() {
    compose.onNodeWithText("Systems").assertIsEnabled()
    compose.onNodeWithText("Workflows").assertIsEnabled()
    compose.onNodeWithText("Deep Analyze").assertIsNotEnabled()
    compose.onNodeWithText("Offline mode").assertIsDisplayed()
}

@Test fun protected_content_is_hidden_until_device_authentication_succeeds() {
    compose.onNodeWithText("Unlock Kairo").assertIsDisplayed()
    compose.onNodeWithText("Merge PACS").assertDoesNotExist()
    fakeAuthenticator.succeed()
    compose.onNodeWithText("Merge PACS").assertIsDisplayed()
}
```

- [ ] **Step 2: Verify tests fail**

Run: `.\gradlew.bat :apps:android:connectedDebugAndroidTest`  
Expected: FAIL because the application shell is incomplete.

- [ ] **Step 3: Implement the premium dark, chat-first UI**

Use one capability-aware state model; do not read Room from screens. Require device authentication at launch and after configurable background timeout, with biometric or device credential through the platform prompt; never render protected content beneath the lock surface. Answers display Assessment, Current MANA Understanding, planned/product/hypothesis/unknown sections as applicable, next action, qualitative confidence, and tappable evidence. Capture displays PHI choices before continuation. Source viewer opens exact pages/regions/ranges where supported.

- [ ] **Step 4: Run Android unit, instrumented, accessibility, and offline tests**

Run: `.\gradlew.bat :apps:android:testDebugUnitTest :apps:android:connectedDebugAndroidTest`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/android
git commit -m "feat: deliver Android Kairo V1 experience"
```

### Task 12: Add secure browser-to-Core pairing and stateless relay tunnel

**Files:**
- Create: `relay/src/pairing/PairingService.ts`
- Create: `relay/src/tunnel/TunnelBroker.ts`
- Create: `apps/android/src/main/kotlin/kairo/android/tunnel/CoreTunnelClient.kt`
- Create: `apps/desktop-web/src/security/pairedTunnel.ts`
- Create: `relay/test/tunnel.test.ts`
- Create: `apps/desktop-web/src/security/pairedTunnel.test.ts`
- Create: `docs/decisions/ADR-0002-desktop-tunnel-cryptography.md`

**Interfaces:**
- Consumes: `CoreCommandV1` envelopes.
- Produces: one-time pairing, mutually authenticated session, chunked encrypted command/file transport, replay protection, expiry, and disconnect cleanup.

- [ ] **Step 1: Write failing confidentiality and lifecycle tests**

```ts
it("the relay can route but cannot decrypt a Core command", async () => {
  const captured = await broker.captureRoutedFrame(encrypt(command, sessionKey));
  expect(JSON.stringify(captured)).not.toContain("AbbaDox");
});

it("expired and replayed frames are rejected", async () => {
  await expect(broker.route(expiredFrame)).rejects.toThrow("session_expired");
  await expect(broker.route(validFrameTwice)).rejects.toThrow("replay_detected");
});
```

- [ ] **Step 2: Verify tests fail**

Run: `pnpm --filter @kairo/relay test && pnpm --filter @kairo/desktop-web test`  
Expected: FAIL.

- [ ] **Step 3: Implement ephemeral pairing and end-to-end encryption**

Use Web Crypto-compatible ECDH, HKDF-derived session keys, AES-GCM frames, monotonic sequence numbers, short-lived pairing codes, explicit device confirmation, bounded chunk sizes, and no relay payload logging. ADR-0002 records the algorithm suite, rotation, threat model, and recovery behavior. The relay keeps only live routing metadata and expires it on disconnect.

- [ ] **Step 4: Run unit and integration tests**

Run: `pnpm --filter @kairo/relay test`  
Run: `pnpm --filter @kairo/desktop-web test`  
Run: `.\gradlew.bat :apps:android:testDebugUnitTest`  
Expected: PASS for pairing, cancellation, expiry, replay rejection, corrupted frames, chunk reassembly, and cleanup.

- [ ] **Step 5: Commit**

```bash
git add relay apps/android apps/desktop-web docs/decisions/ADR-0002-desktop-tunnel-cryptography.md
git commit -m "feat: pair desktop with Android Kairo Core securely"
```

### Task 13: Build browser desktop capture, Copilot, and evidence review

**Files:**
- Create: `apps/desktop-web/src/app/App.tsx`
- Create: `apps/desktop-web/src/features/capture/CaptureWorkspace.tsx`
- Create: `apps/desktop-web/src/features/copilot/CopilotWorkspace.tsx`
- Create: `apps/desktop-web/src/features/evidence/EvidencePane.tsx`
- Create: `apps/desktop-web/src/features/memory/MemoryInbox.tsx`
- Create: `apps/desktop-web/src/features/projects/ProjectsWorkspace.tsx`
- Test: `apps/desktop-web/e2e/desktop-workflow.spec.ts`

**Interfaces:**
- Consumes: paired tunnel and Core commands.
- Produces: no-install browser UI for batch upload, Ask Kairo, Deep Analyze, source/evidence inspection, Memory Inbox, and Projects.

- [ ] **Step 1: Write failing Playwright workflow**

```ts
test("uploads a meeting batch and reviews an evidence-linked candidate", async ({ page }) => {
  await pairWithTestCore(page);
  await page.getByTestId("capture-dropzone").setInputFiles(meetingFixtureFiles);
  await page.getByRole("button", { name: "Analyze together" }).click();
  await expect(page.getByText("AbbaDox")).toBeVisible();
  await page.getByRole("button", { name: "Open evidence" }).click();
  await expect(page.getByTestId("source-anchor")).toBeVisible();
});
```

- [ ] **Step 2: Verify the E2E test fails**

Run: `pnpm --filter @kairo/desktop-web e2e --grep "uploads a meeting batch"`  
Expected: FAIL.

- [ ] **Step 3: Implement split-view desktop workspaces**

Stream encrypted files directly to the paired Core; never retain completed uploads in browser local storage. Show upload progress, PHI decisions returned by the Core, ingestion stage, candidates, and exact source anchors. Copilot and evidence panes remain visible together on large screens.

- [ ] **Step 4: Run desktop unit, accessibility, and E2E tests**

Run: `pnpm --filter @kairo/desktop-web test`  
Run: `pnpm --filter @kairo/desktop-web e2e`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-web
git commit -m "feat: deliver browser desktop Kairo client"
```

### Task 14: Import the Genesis Corpus and establish the private benchmark

**Files:**
- Create: `validation/corpus/manifest.schema.json`
- Create: `validation/corpus/genesis-manifest.json`
- Create: `validation/benchmarks/questions.v1.json`
- Create: `validation/benchmarks/expected.v1.json`
- Create: `core/ingestion/src/main/kotlin/kairo/ingestion/GenesisImporter.kt`
- Test: `core/ingestion/src/test/kotlin/kairo/ingestion/GenesisImporterTest.kt`

**Interfaces:**
- Consumes: ingestion, candidate creation, repository, scopes, source authority.
- Produces: reproducible, review-gated Genesis import and benchmark evaluation report.

- [ ] **Step 1: Write failing manifest and authority tests**

```kotlin
@Test fun `raw ChatGPT statements import as candidates not confirmed facts`() = runTest {
    val result = importer.import(chatFixture)
    assertTrue(result.candidates.all { it.proposedState != EvidenceState.CONFIRMED })
}
```

- [ ] **Step 2: Verify tests fail**

Run: `.\gradlew.bat :core:ingestion:test --tests "*GenesisImporterTest"`  
Expected: FAIL.

- [ ] **Step 3: Implement manifest-driven import**

The manifest includes Merge/AMICAS PACS, Merge RIS, AbbaDox, MagView, eCW, Hologic, PowerScribe, Rad AI, Altamont, DynaCAD, AbbaDox migration, Baxter, Rad AI/ViewPoint-retirement direction, and breast changes. It records classification, authority, expected scope, sensitivity review, and hash; binary/private corpus contents stay outside source control.

- [ ] **Step 4: Run import and benchmark tests**

Run: `.\gradlew.bat :core:ingestion:test :core:retrieval:test`  
Expected: PASS; benchmark output distinguishes breast current/planned architecture and does not promote unreviewed chat claims.

- [ ] **Step 5: Commit non-sensitive manifests and tests**

```bash
git add validation/corpus/manifest.schema.json validation/corpus/genesis-manifest.json validation/benchmarks core/ingestion
git commit -m "feat: add controlled Genesis import and benchmark"
```

### Task 15: Prove security, migration, offline, and full Definition of Done

**Files:**
- Create: `validation/e2e/kairo-v1-definition-of-done.md`
- Create: `validation/e2e/DefinitionOfDoneTest.kt`
- Create: `validation/security/phi-boundary.spec.ts`
- Create: `validation/security/relay-retention.spec.ts`
- Create: `validation/reports/.gitkeep`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: the complete product.
- Produces: reproducible V1 release gate with machine-readable pass/fail output and a human evidence checklist.

- [ ] **Step 1: Encode the locked end-to-end scenario as a failing test**

```kotlin
@Test fun `Kairo V1 learns and answers AbbaDox routing with evidence`() = runTest {
    desktop.uploadTogether(docx, pdf, screenshot, xlsx)
    desktop.choosePhiAction(REDACT)
    desktop.approveSelectedCandidates()
    val answer = android.ask("What's our current understanding of AbbaDox worklist routing?")
    assertTrue(answer.claims.any { it.state == EvidenceState.PLANNED })
    assertTrue(answer.claims.all { it.evidenceRefs.isNotEmpty() || it.state == EvidenceState.HYPOTHESIS })
    assertFalse(answer.renderedText.contains(testPatientMrn))
    assertNotNull(android.deepAnalyze(answer.question).nextBestAction)
}
```

- [ ] **Step 2: Run the complete gate and record all initial failures**

Run: `.\gradlew.bat check connectedCheck`  
Run: `pnpm test -r`  
Run: `pnpm --filter @kairo/desktop-web e2e`  
Expected: the gate remains red until every requirement is connected in the release configuration.

- [ ] **Step 3: Fix only integration defects exposed by the gate**

Do not add new scope. Wire missing production adapters, test fixtures, CI services, backup-exclusion assertions, relay no-retention assertions, encrypted export/import verification, index rebuild verification, and migration fixtures. For every defect, add or tighten the smallest failing test before the fix.

- [ ] **Step 4: Run the full release verification fresh**

Run: `.\gradlew.bat clean check connectedCheck`  
Run: `pnpm test -r`  
Run: `pnpm --filter @kairo/desktop-web e2e`  
Run: `pnpm audit --prod`  
Expected: all commands exit 0; the Definition of Done report shows every locked Knowledge, Evidence, Retrieval, AI, PHI, Migration, Offline, and Desktop criterion passing.

- [ ] **Step 5: Perform the final scope and secret review**

Run: `git diff --check`  
Run: `git grep -n -E "(sk-[A-Za-z0-9_-]{20,}|BEGIN (RSA|EC|OPENSSH) PRIVATE KEY|patientMrnTestValue)" -- ':!validation/fixtures/synthetic/**'`  
Expected: no whitespace errors, credentials, real identifiers, or unapproved V1 features.

- [ ] **Step 6: Commit the verified V1 gate**

```bash
git add .github README.md validation
git commit -m "test: enforce Kairo V1 definition of done"
```

## Self-review record

### Spec coverage

- Product vision and expertise: Global Constraints, Tasks 8–10, 14.
- Kairo Core and multi-client amendment: Tasks 1, 4, 11–13.
- Evidence, temporal model, scopes, contradictions: Tasks 2–4, 8–10.
- Universal artifact ingestion and immutable sources: Tasks 5–6, 13.
- PHI/session and advisory-only boundaries: Tasks 5, 9, 11–12, 15.
- Memory lifecycle: Task 7.
- Structured/lexical/semantic retrieval: Task 8.
- Quick, gateway, validation, Deep Analyze: Tasks 9–10.
- Workflows, Trace, MANA current/planned distinction: Tasks 3 and 10.
- Projects, incidents, decisions, risks, questions: Tasks 3, 7, 10–11, 13.
- Android offline and browser desktop: Tasks 11–13.
- Genesis Corpus: Task 14.
- Testing, migration, trust, and V1 Definition of Done: Tasks 4, 8–10, 14–15.
- Explicit V1 deferrals remain excluded throughout the plan.

### Type consistency

The plan consistently uses `FactVersion`, `EvidenceRef`, `SourceAnchor`, `MemoryCandidateDraft`, `EvidenceBundle`, `KairoAnswer`, `KnowledgeRepository`, `HybridRetriever`, `ReasoningProvider`, and the versioned `CoreCommandV1` contract. TypeScript shapes are generated from `shared/contracts`; Kotlin mapping tests guard parity.

### Placeholder and scope scan

The plan contains no unfinished-work markers or unspecified “handle errors/write tests” steps. The first physical Core host is explicitly selected and recorded in ADR-0001. PPTX remains a post-launch-blocker addition exactly as permitted by the locked V1 scope; all required modern formats are in Task 6. No implementation code is created by this planning artifact.
