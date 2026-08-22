package kairo.retrieval

import java.time.Instant
import kairo.domain.EntityId
import kairo.domain.EvidenceRef
import kairo.domain.EvidenceState
import kairo.domain.FactId
import kairo.domain.FactObject
import kairo.domain.FactVersion
import kairo.domain.KnowledgeScope
import kairo.domain.AnchorLocator
import kairo.domain.IncidentPattern
import kairo.domain.IncidentPatternId
import kairo.domain.SourceAnchor
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.domain.WorkflowId
import kairo.domain.ExtractionStatus
import kairo.domain.OpenQuestion
import kairo.domain.OpenQuestionId
import kairo.domain.Project
import kairo.domain.ProjectId
import kairo.domain.ProjectStatus
import kairo.domain.ProjectTimeline
import kairo.domain.Source
import kairo.domain.SourceClassification
import kairo.domain.SourceOrigin
import kairo.domain.SourceType
import kairo.domain.SourceVariant
import kairo.domain.Workflow
import kairo.domain.WorkflowState
import kairo.domain.WorkflowStep
import kairo.domain.WorkflowStepId
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class HybridRetrieverTest {

    @Test
    fun `MANA production evidence outranks external vendor capability`() {
        val productionFact = fact(
            id = "fact-production",
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.CONFIRMED,
            text = "Merge PACS hosts DMWL.",
        )

        val vendorFact = fact(
            id = "fact-vendor",
            scope = KnowledgeScope.EXTERNAL_RESEARCH,
            state = EvidenceState.CONFIRMED,
            text = "A RIS can provide DICOM modality worklist.",
        )

        val retriever = HybridRetriever(
            facts = listOf(
                vendorFact,
                productionFact,
            ),
        )

        val result = retriever.retrieve(
            RetrievalQuery(
                text = "Who hosts DMWL?",
                scope = KnowledgeScope.MANA_PRODUCTION,
            ),
        )

        assertEquals(
            productionFact.id,
            result.rankedClaims.first().fact.id,
        )
    }


    @Test
    fun `semantic query retrieves routing incident without exact phrase`() {
        val incident = IncidentPattern(
            id = IncidentPatternId("incident-magview-routing"),
            symptom = "Breast studies are not arriving in MagView for interpretation.",
            affectedWorkflow = WorkflowId("breast-imaging"),
            rootCause = "Routing destination configuration is incorrect.",
            resolution = "Correct the routing destination and resend the study.",
            prevention = "Validate routing configuration after changes.",
            scope = KnowledgeScope.INCIDENT,
            evidenceState = EvidenceState.OBSERVED,
            evidenceAnchors = setOf(
                SourceAnchor(
                    sourceId = SourceId("source-incident"),
                    variantId = SourceVariantId("variant-incident"),
                    locator = AnchorLocator.TextSpan(0, 30),
                ),
            ),
        )

        val retriever = HybridRetriever(
            facts = emptyList(),
            incidents = listOf(incident),
        )

        val result = retriever.retrieve(
            RetrievalQuery(
                text = "studies failing to reach interpretation",
                scope = KnowledgeScope.MANA_PRODUCTION,
            ),
        )

        assertEquals(
            incident.id,
            result.incidents.single().id,
        )
    }


    @Test
    fun `currently applicable production fact outranks expired historical fact`() {
        val historical = FactVersion(
            id = FactId("fact-historical-ris"),
            subject = EntityId("non-breast-imaging"),
            predicate = "uses-ris",
            objectValue = FactObject.Literal("Merge RIS"),
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.CONFIRMED,
            effectiveFrom = Instant.parse("2025-01-01T00:00:00Z"),
            effectiveTo = Instant.parse("2026-09-01T23:59:59Z"),
            recordedAt = Instant.parse("2026-01-01T00:00:00Z"),
            lastValidatedAt = Instant.parse("2026-08-01T00:00:00Z"),
            evidence = setOf(EvidenceRef("source-historical")),
        )

        val current = FactVersion(
            id = FactId("fact-current-ris"),
            subject = EntityId("non-breast-imaging"),
            predicate = "uses-ris",
            objectValue = FactObject.Literal("AbbaDox CareFlow"),
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.CONFIRMED,
            effectiveFrom = Instant.parse("2026-09-02T00:00:00Z"),
            effectiveTo = null,
            recordedAt = Instant.parse("2026-08-22T00:00:00Z"),
            lastValidatedAt = Instant.parse("2026-08-22T00:00:00Z"),
            evidence = setOf(EvidenceRef("source-current")),
        )

        val retriever = HybridRetriever(
            facts = listOf(
                historical,
                current,
            ),
        )

        val result = retriever.retrieve(
            RetrievalQuery(
                text = "What RIS does non breast imaging use?",
                scope = KnowledgeScope.MANA_PRODUCTION,
                at = Instant.parse("2026-09-03T12:00:00Z"),
            ),
        )

        assertEquals(
            current.id,
            result.rankedClaims.first().fact.id,
        )
    }


    @Test
    fun `contradicted production fact does not outrank valid current evidence`() {
        val contradicted = FactVersion(
            id = FactId("fact-contradicted"),
            subject = EntityId("pacs-routing"),
            predicate = "destination",
            objectValue = FactObject.Literal("Legacy destination"),
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.CONTRADICTED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt = Instant.parse("2026-08-22T00:00:00Z"),
            lastValidatedAt = Instant.parse("2026-08-22T00:00:00Z"),
            evidence = emptySet(),
        )

        val current = FactVersion(
            id = FactId("fact-current"),
            subject = EntityId("pacs-routing"),
            predicate = "destination",
            objectValue = FactObject.Literal("Current production destination"),
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.OBSERVED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt = Instant.parse("2026-08-22T01:00:00Z"),
            lastValidatedAt = Instant.parse("2026-08-22T01:00:00Z"),
            evidence = setOf(EvidenceRef("source-current")),
        )

        val retriever = HybridRetriever(
            facts = listOf(
                contradicted,
                current,
            ),
        )

        val result = retriever.retrieve(
            RetrievalQuery(
                text = "What is the PACS routing destination?",
                scope = KnowledgeScope.MANA_PRODUCTION,
                at = Instant.parse("2026-08-22T12:00:00Z"),
            ),
        )

        assertEquals(
            current.id,
            result.rankedClaims.first().fact.id,
        )
    }


    @Test
    fun `corroborated evidence outranks otherwise equal single source claim`() {
        val singleSource = FactVersion(
            id = FactId("a-single-source"),
            subject = EntityId("merge-pacs"),
            predicate = "hosts",
            objectValue = FactObject.Literal("Merge PACS hosts DMWL."),
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.OBSERVED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt = Instant.parse("2026-08-22T01:00:00Z"),
            lastValidatedAt = Instant.parse("2026-08-22T01:00:00Z"),
            evidence = setOf(
                EvidenceRef("source-a"),
            ),
        )

        val corroborated = FactVersion(
            id = FactId("z-corroborated"),
            subject = EntityId("merge-pacs"),
            predicate = "hosts",
            objectValue = FactObject.Literal("Merge PACS hosts DMWL."),
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.OBSERVED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt = Instant.parse("2026-08-22T01:00:00Z"),
            lastValidatedAt = Instant.parse("2026-08-22T01:00:00Z"),
            evidence = setOf(
                EvidenceRef("source-b"),
                EvidenceRef("source-c"),
            ),
        )

        val retriever = HybridRetriever(
            facts = listOf(
                singleSource,
                corroborated,
            ),
        )

        val result = retriever.retrieve(
            RetrievalQuery(
                text = "Who hosts DMWL?",
                scope = KnowledgeScope.MANA_PRODUCTION,
                at = Instant.parse("2026-08-22T12:00:00Z"),
            ),
        )

        assertEquals(
            corroborated.id,
            result.rankedClaims.first().fact.id,
        )
    }


    @Test
    fun `retrieval result exposes complete evidence bundle categories`() {
        val retriever = HybridRetriever(
            facts = emptyList(),
        )

        val bundle = retriever.retrieve(
            RetrievalQuery(
                text = "What do we know?",
                scope = KnowledgeScope.MANA_PRODUCTION,
            ),
        )

        assertTrue(bundle.entities.isEmpty())
        assertTrue(bundle.sources.isEmpty())
        assertTrue(bundle.workflows.isEmpty())
        assertTrue(bundle.projects.isEmpty())
        assertTrue(bundle.incidents.isEmpty())
        assertTrue(bundle.conflicts.isEmpty())
        assertTrue(bundle.unknowns.isEmpty())
    }


    @Test
    fun `evidence bundle includes real source workflow project and unknown context`() {
        val anchor = SourceAnchor(
            sourceId = SourceId("source-context"),
            variantId = SourceVariantId("variant-context"),
            locator = AnchorLocator.TextSpan(0, 20),
        )

        val source = Source(
            id = SourceId("source-context"),
            origin = SourceOrigin.USER_CAPTURE,
            type = SourceType.TEXT,
            contentHash = "hash-context",
            importedAt = Instant.parse("2026-08-22T12:00:00Z"),
            classification = SourceClassification.INTERNAL,
            variants = listOf(
                SourceVariant(
                    id = SourceVariantId("variant-context"),
                    sourceId = SourceId("source-context"),
                    version = 1,
                    contentHash = "hash-context",
                    importedAt = Instant.parse("2026-08-22T12:00:00Z"),
                    parentVariantId = null,
                    extractionStatus = ExtractionStatus.EXTRACTED,
                    anchors = setOf(anchor),
                ),
            ),
            anchors = setOf(anchor),
        )

        val workflow = Workflow(
            id = WorkflowId("workflow-dmwl"),
            name = "Current DMWL Workflow",
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = WorkflowState.CURRENT,
            evidenceState = EvidenceState.OBSERVED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt = Instant.parse("2026-08-22T12:00:00Z"),
            steps = listOf(
                WorkflowStep(
                    id = WorkflowStepId("step-pacs"),
                    name = "Provide DMWL",
                    system = "Merge PACS",
                    evidenceState = EvidenceState.OBSERVED,
                    anchors = setOf(anchor),
                ),
            ),
            evidenceAnchors = setOf(anchor),
        )

        val projectWorkflow = Workflow(
            id = WorkflowId("workflow-project"),
            name = "Future Project Workflow",
            scope = KnowledgeScope.PROJECT,
            state = WorkflowState.FUTURE,
            evidenceState = EvidenceState.PLANNED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt = Instant.parse("2026-08-22T12:00:00Z"),
            steps = listOf(
                WorkflowStep(
                    id = WorkflowStepId("step-project"),
                    name = "Future RIS",
                    system = "AbbaDox",
                    evidenceState = EvidenceState.PLANNED,
                ),
            ),
            evidenceAnchors = emptySet(),
        )

        val project = Project(
            id = ProjectId("project-ris"),
            name = "RIS Transition",
            objective = "Move non-breast imaging to the future RIS.",
            status = ProjectStatus.IMPLEMENTATION,
            timeline = ProjectTimeline(
                startsAt = null,
                endsAt = null,
            ),
            futureArchitecture = listOf(projectWorkflow),
            openQuestions = listOf(
                OpenQuestion(
                    id = OpenQuestionId("question-1"),
                    question = "Has production cutover been validated?",
                    anchors = setOf(anchor),
                ),
            ),
        )

        val retriever = HybridRetriever(
            facts = emptyList(),
            sources = listOf(source),
            workflows = listOf(workflow),
            projects = listOf(project),
        )

        val bundle = retriever.retrieve(
            RetrievalQuery(
                text = "DMWL RIS production",
                scope = KnowledgeScope.MANA_PRODUCTION,
            ),
        )

        assertEquals(
            source.id.value,
            bundle.sources.single().sourceId,
        )

        assertEquals(
            workflow.id.value,
            bundle.workflows.single().id,
        )

        assertEquals(
            project.id.value,
            bundle.projects.single().id,
        )

        assertTrue(
            bundle.unknowns.contains(
                "Has production cutover been validated?",
            ),
        )
    }

    private fun fact(
        id: String,
        scope: KnowledgeScope,
        state: EvidenceState,
        text: String,
    ): FactVersion =
        FactVersion(
            id = FactId(id),
            subject = EntityId("merge-pacs"),
            predicate = "hosts",
            objectValue = FactObject.Literal(text),
            scope = scope,
            state = state,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt = Instant.parse("2026-08-22T13:00:00Z"),
            lastValidatedAt = null,
            evidence = setOf(
                EvidenceRef("source-1"),
            ),
        )
}
