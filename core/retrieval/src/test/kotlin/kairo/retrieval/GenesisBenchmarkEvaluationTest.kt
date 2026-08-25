package kairo.retrieval

import java.nio.file.Files
import java.nio.file.Path
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
import kotlin.test.assertTrue

class GenesisBenchmarkEvaluationTest {

    @Test
    fun `versioned benchmark declares current planned product project and unknown invariants`() {
        val questions = Files.readString(validationFile("questions.v1.json"))
        val expectations = Files.readString(validationFile("expected.v1.json"))

        assertTrue(questions.contains("kairo-private-benchmark-questions/v1"))
        assertTrue(expectations.contains("kairo-private-benchmark-expectations/v1"))
        assertTrue(expectations.contains("CURRENT_AND_PLANNED_MUST_BE_DISTINGUISHED"))
        assertTrue(expectations.contains("PRODUCT_DOES_NOT_PROVE_MANA_PRODUCTION"))
        assertTrue(expectations.contains("PROJECT_SCOPE_MUST_NOT_BECOME_UNIVERSAL_MANA_TRUTH"))
        assertTrue(expectations.contains("QUALIFIED_UNKNOWN"))
    }

    @Test
    fun `synthetic benchmark exercises retriever scope temporal evidence and unknown behavior`() {
        val current = fact(
            id = "synthetic-current-breast",
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.OBSERVED,
            text = "Synthetic current breast architecture.",
        )
        val planned = fact(
            id = "synthetic-planned-transition",
            scope = KnowledgeScope.PROJECT,
            state = EvidenceState.PLANNED,
            text = "Synthetic planned non breast transition.",
        )
        val product = fact(
            id = "synthetic-vendor-capability",
            scope = KnowledgeScope.PRODUCT,
            state = EvidenceState.CONFIRMED,
            text = "Synthetic vendor capability.",
        )
        val retriever = HybridRetriever(facts = listOf(product, planned, current))

        val result = retriever.retrieve(
            RetrievalQuery(
                text = "synthetic breast architecture transition",
                scope = KnowledgeScope.MANA_PRODUCTION,
                at = Instant.parse("2026-08-24T12:00:00Z"),
            ),
        )

        assertEquals(current.id, result.rankedClaims.first().fact.id)
        assertTrue(result.rankedClaims.first().fact.evidence.isNotEmpty())
        assertTrue(result.rankedClaims.any { it.fact.scope == KnowledgeScope.PROJECT && it.fact.state == EvidenceState.PLANNED })

        val unknown = HybridRetriever(facts = emptyList()).retrieve(
            RetrievalQuery("unsupported synthetic MANA service", KnowledgeScope.MANA_PRODUCTION),
        )
        assertTrue(unknown.rankedClaims.isEmpty())
    }

    private fun fact(
        id: String,
        scope: KnowledgeScope,
        state: EvidenceState,
        text: String,
    ): FactVersion = FactVersion(
        id = FactId(id),
        subject = EntityId("synthetic-subject-$id"),
        predicate = "states",
        objectValue = FactObject.Literal(text),
        scope = scope,
        state = state,
        effectiveFrom = null,
        effectiveTo = null,
        recordedAt = Instant.parse("2026-08-24T12:00:00Z"),
        lastValidatedAt = null,
        evidence = setOf(EvidenceRef("synthetic-source-$id")),
    )

    private fun validationFile(name: String): Path =
        generateSequence(Path.of("").toAbsolutePath().normalize()) { it.parent }
            .map { it.resolve("validation/benchmarks/$name") }
            .firstOrNull(Files::isRegularFile)
            ?: error("Unable to locate validation benchmark $name")
}
