package kairo.application

import java.time.Instant
import java.util.UUID
import kairo.domain.EntityId
import kairo.domain.EvidenceRef
import kairo.domain.EvidenceState
import kairo.domain.FactId
import kairo.domain.FactLineageId
import kairo.domain.FactObject
import kairo.domain.FactVersion
import kairo.domain.KnowledgeScope
import kairo.ingestion.MemoryCandidateDraft

@JvmInline
value class MemoryCandidateId(val value: String) {
    init {
        require(value.isNotBlank()) { "MemoryCandidateId must not be blank" }
    }
}

data class PendingMemoryCandidate(
    val id: MemoryCandidateId,
    val draft: MemoryCandidateDraft,
)

class MemoryInboxService(
    private val repository: KnowledgeRepository,
    private val now: () -> Instant = Instant::now,
) {
    private val pendingCandidates = linkedMapOf<MemoryCandidateId, PendingMemoryCandidate>()

    fun receive(candidate: MemoryCandidateDraft): PendingMemoryCandidate {
        val pending = PendingMemoryCandidate(
            id = MemoryCandidateId(UUID.randomUUID().toString()),
            draft = candidate,
        )

        pendingCandidates[pending.id] = pending
        return pending
    }

    fun pending(): List<PendingMemoryCandidate> =
        pendingCandidates.values.toList()

    suspend fun approve(
        candidateId: MemoryCandidateId,
        reviewer: String,
    ) {
        require(reviewer.isNotBlank()) { "Reviewer must not be blank" }

        val candidate = requireNotNull(
            pendingCandidates[candidateId],
        ) {
            "Unknown memory candidate: ${candidateId.value}"
        }

        val subjectId = EntityId(
            candidate.draft.subjectLabel
                .trim()
                .lowercase()
                .replace(Regex("[^a-z0-9]+"), "-")
                .trim('-'),
        )

        val text = candidate.draft.text.trim()

        val factId = FactId("memory-${candidate.id.value}")

        val fact = FactVersion(
            id = factId,
            lineageId = FactLineageId(factId.value),
            subject = subjectId,
            predicate = inferPredicate(text),
            objectValue = FactObject.Literal(text),
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.OBSERVED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt = now(),
            lastValidatedAt = null,
            evidence = candidate.draft.evidenceAnchors.map { anchor ->
                EvidenceRef(
                    "${anchor.sourceId.value}:${anchor.variantId.value}:${anchor.locator.hashCode()}",
                )
            }.toSet(),
        )

        repository.appendFactVersion(
            fact = fact,
            audit = AuditEvent(
                id = "audit-${UUID.randomUUID()}",
                action = "MEMORY_APPROVED",
                targetType = "MEMORY_CANDIDATE",
                targetId = candidate.id.value,
                occurredAt = now(),
                correlationId = candidate.draft.sessionId.value,
            ),
        )

        pendingCandidates.remove(candidateId)
    }

    private fun inferPredicate(text: String): String =
        when {
            text.contains(" hosts ", ignoreCase = true) -> "hosts"
            else -> "states"
        }
}
