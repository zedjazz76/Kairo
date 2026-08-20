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
    fun `later current revision retires its confirmed predecessor`() {
        val predecessor = fact(
            id = "fact-confirmed",
            state = EvidenceState.CONFIRMED,
            recordedAt = "2026-08-01T00:00:00Z",
        )
        val revision = fact(
            id = "fact-observed-revision",
            state = EvidenceState.OBSERVED,
            recordedAt = "2026-08-02T00:00:00Z",
            supersedes = predecessor.id,
        )

        val result = CurrentBestUnderstanding.project(listOf(predecessor, revision))

        assertEquals(revision.id, result.single().id)
        assertEquals(listOf(predecessor, revision), result.history)
    }

    @Test
    fun `planned successor does not retire current production truth`() {
        val production = fact(id = "fact-production", state = EvidenceState.CONFIRMED)
        val plannedSuccessor = fact(
            id = "fact-planned-successor",
            state = EvidenceState.PLANNED,
            recordedAt = "2026-08-02T00:00:00Z",
            supersedes = production.id,
        )

        val result = CurrentBestUnderstanding.project(listOf(production, plannedSuccessor))

        assertEquals(production.id, result.single().id)
    }

    @Test
    fun `a project successor cannot retire production truth regardless of its state`() {
        val production = fact(id = "fact-production", state = EvidenceState.CONFIRMED)
        val projectContradiction = fact(
            id = "fact-project-contradiction",
            scope = KnowledgeScope.PROJECT,
            state = EvidenceState.CONTRADICTED,
            recordedAt = "2026-08-02T00:00:00Z",
            supersedes = production.id,
        )

        val result = CurrentBestUnderstanding.project(listOf(production, projectContradiction))

        assertEquals(production.id, result.single().id)
        assertEquals(listOf(production, projectContradiction), result.history)
    }

    @Test
    fun `concurrently current MANA understanding outranks project understanding`() {
        val mana = fact(
            id = "fact-mana",
            objectValue = "Merge RIS",
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.OBSERVED,
        )
        val project = fact(
            id = "fact-project",
            objectValue = "AbbaDox",
            scope = KnowledgeScope.PROJECT,
            state = EvidenceState.CONFIRMED,
        )

        val result = CurrentBestUnderstanding.project(listOf(project, mana))

        assertEquals(mana.id, result.single().id)
    }

    @Test
    fun `effective time boundaries include start and exclude end`() {
        val boundary = Instant.parse("2026-08-20T00:00:00Z")
        val startsAtBoundary = fact(
            id = "fact-starts",
            effectiveFrom = boundary,
            effectiveTo = null,
        )
        val endsAtBoundary = fact(
            id = "fact-ends",
            subject = EntityId("system-ris"),
            effectiveFrom = Instant.parse("2026-01-01T00:00:00Z"),
            effectiveTo = boundary,
        )

        val result = CurrentBestUnderstanding.project(listOf(endsAtBoundary, startsAtBoundary), at = boundary)

        assertEquals(listOf(startsAtBoundary.id), result.current.map { it.id })
        assertEquals(listOf(endsAtBoundary.id, startsAtBoundary.id), result.history.map { it.id })
    }

    @Test
    fun `equal timestamps use deterministic identifiers for current and history ordering`() {
        val first = fact(id = "fact-a", objectValue = "First")
        val second = fact(id = "fact-z", objectValue = "Second")

        val result = CurrentBestUnderstanding.project(listOf(second, first))

        assertEquals(FactId("fact-z"), result.single().id)
        assertEquals(listOf(FactId("fact-a"), FactId("fact-z")), result.history.map { it.id })
    }

    @Test
    fun `projection rejects duplicate fact identifiers before selecting current truth`() {
        val original = fact(id = "fact-duplicate", objectValue = "Merge RIS")
        val conflictingDuplicate = fact(id = "fact-duplicate", objectValue = "AbbaDox")

        val exception = assertFailsWith<IllegalArgumentException> {
            CurrentBestUnderstanding.project(listOf(original, conflictingDuplicate))
        }

        assertTrue(exception.message.orEmpty().contains("fact-duplicate"))
    }

    @Test
    fun `projection rejects identical duplicate fact identifiers`() {
        val duplicate = fact(id = "fact-duplicate")

        val exception = assertFailsWith<IllegalArgumentException> {
            CurrentBestUnderstanding.project(listOf(duplicate, duplicate.copy()))
        }

        assertTrue(exception.message.orEmpty().contains("fact-duplicate"))
    }

    @Test
    fun `fact evidence is an immutable snapshot and copy remains usable`() {
        val suppliedEvidence = mutableSetOf(EvidenceRef("source-1", extractionConfidence = 0.91))
        val fact = fact(evidence = suppliedEvidence)

        suppliedEvidence.clear()

        assertFailsWith<UnsupportedOperationException> {
            (fact.evidence as MutableSet<EvidenceRef>).clear()
        }
        assertEquals(setOf(EvidenceRef("source-1", extractionConfidence = 0.91)), fact.evidence)
        assertEquals(EvidenceState.OBSERVED, fact.copy(state = EvidenceState.OBSERVED).state)
    }

    @Test
    fun `projection current and history are immutable snapshots`() {
        val suppliedCurrent = mutableListOf(
            fact(id = "fact-snapshot-a"),
            fact(id = "fact-snapshot-b", subject = EntityId("system-ris")),
        )
        val suppliedHistory = suppliedCurrent.toMutableList()
        val result = CurrentBestUnderstanding(suppliedCurrent, suppliedHistory)

        suppliedCurrent.clear()
        suppliedHistory.clear()

        assertFailsWith<UnsupportedOperationException> {
            (result.current as MutableList<FactVersion>).clear()
        }
        assertFailsWith<UnsupportedOperationException> {
            (result.history as MutableList<FactVersion>).clear()
        }
        assertEquals(listOf(FactId("fact-snapshot-a"), FactId("fact-snapshot-b")), result.current.map { it.id })
        assertEquals(listOf(FactId("fact-snapshot-a"), FactId("fact-snapshot-b")), result.history.map { it.id })
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
        subject: EntityId = EntityId("system-pacs"),
        predicate: String = "USES",
        effectiveFrom: Instant? = Instant.parse("2026-01-01T00:00:00Z"),
        effectiveTo: Instant? = null,
        evidence: Set<EvidenceRef> = setOf(EvidenceRef("source-1", extractionConfidence = 0.91)),
        supersedes: FactId? = null,
    ) = FactVersion(
        id = FactId(id),
        subject = subject,
        predicate = predicate,
        objectValue = FactObject.Literal(objectValue),
        scope = scope,
        state = state,
        effectiveFrom = effectiveFrom,
        effectiveTo = effectiveTo,
        recordedAt = Instant.parse(recordedAt),
        lastValidatedAt = null,
        evidence = evidence,
        supersedes = supersedes,
    )
}
