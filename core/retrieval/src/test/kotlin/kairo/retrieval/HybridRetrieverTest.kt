package kairo.retrieval

import java.time.Instant
import kairo.domain.EntityId
import kairo.domain.EvidenceRef
import kairo.domain.EvidenceState
import kairo.domain.FactId
import kairo.domain.FactObject
import kairo.domain.FactVersion
import kairo.domain.KnowledgeScope
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
