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
import kotlin.test.Test
import kotlin.test.assertEquals

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
