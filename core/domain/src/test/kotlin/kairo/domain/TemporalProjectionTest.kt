package kairo.domain

import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class TemporalProjectionTest {
    @Test
    fun `planned project fact never replaces confirmed production fact`() {
        val confirmedProduction = fact(
            id = "fact-production",
            objectValue = "Merge RIS",
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.CONFIRMED,
            recordedAt = "2026-08-01T00:00:00Z",
        )
        val plannedProject = fact(
            id = "fact-project",
            objectValue = "AbbaDox",
            scope = KnowledgeScope.PROJECT,
            state = EvidenceState.PLANNED,
            recordedAt = "2026-08-02T00:00:00Z",
        )

        val result = CurrentBestUnderstanding.project(
            listOf(confirmedProduction, plannedProject),
            at = Instant.parse("2026-08-20T00:00:00Z"),
        )

        assertEquals(confirmedProduction.id, result.single().id)
        assertTrue(plannedProject in result.history)
    }

    @Test
    fun `later contradiction preserves both versions in history`() {
        val oldFact = fact(
            id = "fact-old",
            objectValue = "PACS routes to workstation A",
            state = EvidenceState.CONFIRMED,
            recordedAt = "2026-08-01T00:00:00Z",
        )
        val contradictedRevision = fact(
            id = "fact-revision",
            objectValue = "PACS routes to workstation A",
            state = EvidenceState.CONTRADICTED,
            recordedAt = "2026-08-02T00:00:00Z",
            supersedes = oldFact.id,
        )

        val result = CurrentBestUnderstanding.project(listOf(oldFact, contradictedRevision))

        assertEquals(EvidenceState.CONTRADICTED, result.history.last().state)
        assertEquals(2, result.history.size)
        assertTrue(result.isEmpty())
    }

    @Test
    fun `expired confirmed fact remains historical instead of current`() {
        val expiredFact = fact(
            id = "fact-expired",
            state = EvidenceState.CONFIRMED,
        ).copy(effectiveTo = Instant.parse("2026-02-01T00:00:00Z"))

        val result = CurrentBestUnderstanding.project(
            listOf(expiredFact),
            at = Instant.parse("2026-08-20T00:00:00Z"),
        )

        assertTrue(result.isEmpty())
        assertEquals(listOf(expiredFact), result.history)
    }

    @Test
    fun `important active facts require source evidence`() {
        val exception = assertFailsWith<IllegalArgumentException> {
            fact(evidence = emptySet())
        }

        assertTrue(exception.message.orEmpty().contains("evidence"))
    }

    @Test
    fun `machine extraction confidence remains distinct from evidence state`() {
        val fact = fact(
            state = EvidenceState.OBSERVED,
            evidence = setOf(EvidenceRef("source-7", extractionConfidence = 0.42)),
        )

        assertEquals(EvidenceState.OBSERVED, fact.state)
        assertEquals(0.42, fact.evidence.single().extractionConfidence)
    }

    @Test
    fun `domain enums retain the contract scope and evidence state names`() {
        assertEquals(
            setOf("MANA_PRODUCTION", "PRODUCT", "PROJECT", "INCIDENT", "EXTERNAL_RESEARCH"),
            KnowledgeScope.entries.map { it.name }.toSet(),
        )
        assertEquals(
            setOf("CONFIRMED", "OBSERVED", "PLANNED", "PROPOSED", "HYPOTHESIS", "VERIFY", "DEPRECATED", "CONTRADICTED"),
            EvidenceState.entries.map { it.name }.toSet(),
        )
    }

    private fun fact(
        id: String = "fact-1",
        objectValue: String = "Merge PACS",
        scope: KnowledgeScope = KnowledgeScope.MANA_PRODUCTION,
        state: EvidenceState = EvidenceState.CONFIRMED,
        recordedAt: String = "2026-08-01T00:00:00Z",
        evidence: Set<EvidenceRef> = setOf(EvidenceRef("source-1", extractionConfidence = 0.91)),
        supersedes: FactId? = null,
    ) = FactVersion(
        id = FactId(id),
        subject = EntityId("system-pacs"),
        predicate = "USES",
        objectValue = FactObject.Literal(objectValue),
        scope = scope,
        state = state,
        effectiveFrom = Instant.parse("2026-01-01T00:00:00Z"),
        effectiveTo = null,
        recordedAt = Instant.parse(recordedAt),
        lastValidatedAt = null,
        evidence = evidence,
        supersedes = supersedes,
    )
}
