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


enum class MemoryDecisionType {
    APPROVED,
    EDITED_AND_APPROVED,
    REJECTED,
    DEFERRED,
}

data class MemoryDecision(
    val candidateId: MemoryCandidateId,
    val type: MemoryDecisionType,
    val reviewer: String,
    val decidedAt: Instant,
    val originalText: String? = null,
    val approvedText: String? = null,
)


interface MemoryInboxStore {
    fun pending(): List<PendingMemoryCandidate>
    fun decisions(): List<MemoryDecision>
    fun savePending(candidate: PendingMemoryCandidate)
    fun removePending(candidateId: MemoryCandidateId)
    fun saveDecision(decision: MemoryDecision)
}

class InMemoryMemoryInboxStore : MemoryInboxStore {
    private val pendingCandidates =
        linkedMapOf<MemoryCandidateId, PendingMemoryCandidate>()

    private val decisionHistory =
        mutableListOf<MemoryDecision>()

    override fun pending(): List<PendingMemoryCandidate> =
        pendingCandidates.values.toList()

    override fun decisions(): List<MemoryDecision> =
        decisionHistory.toList()

    override fun savePending(candidate: PendingMemoryCandidate) {
        pendingCandidates[candidate.id] = candidate
    }

    override fun removePending(candidateId: MemoryCandidateId) {
        pendingCandidates.remove(candidateId)
    }

    override fun saveDecision(decision: MemoryDecision) {
        decisionHistory += decision
    }
}

class MemoryInboxService(
    private val repository: KnowledgeRepository,
    private val now: () -> Instant = Instant::now,
    private val store: MemoryInboxStore = InMemoryMemoryInboxStore(),
) {

    fun receive(candidate: MemoryCandidateDraft): PendingMemoryCandidate {
        val pending = PendingMemoryCandidate(
            id = MemoryCandidateId(UUID.randomUUID().toString()),
            draft = candidate,
        )

        store.savePending(pending)
        return pending
    }

    fun pending(): List<PendingMemoryCandidate> =
        store.pending()

    fun decisions(): List<MemoryDecision> =
        store.decisions()

    fun reject(
        candidateId: MemoryCandidateId,
        reviewer: String,
    ) {
        require(reviewer.isNotBlank()) { "Reviewer must not be blank" }

        requireNotNull(store.pending().firstOrNull { it.id == candidateId }) {
            "Unknown memory candidate: ${candidateId.value}"
        }

        store.saveDecision(MemoryDecision(
            candidateId = candidateId,
            type = MemoryDecisionType.REJECTED,
            reviewer = reviewer,
            decidedAt = now(),
        ))

        store.removePending(candidateId)
    }

    fun defer(
        candidateId: MemoryCandidateId,
        reviewer: String,
    ) {
        require(reviewer.isNotBlank()) { "Reviewer must not be blank" }

        requireNotNull(store.pending().firstOrNull { it.id == candidateId }) {
            "Unknown memory candidate: ${candidateId.value}"
        }

        store.saveDecision(MemoryDecision(
            candidateId = candidateId,
            type = MemoryDecisionType.DEFERRED,
            reviewer = reviewer,
            decidedAt = now(),
        ))
    }

    suspend fun editAndApprove(
        candidateId: MemoryCandidateId,
        reviewer: String,
        editedText: String,
    ) {
        require(reviewer.isNotBlank()) { "Reviewer must not be blank" }
        require(editedText.isNotBlank()) { "Edited text must not be blank" }

        val candidate = requireNotNull(
            store.pending().firstOrNull { it.id == candidateId },
        ) {
            "Unknown memory candidate: ${candidateId.value}"
        }

        promote(
            candidate = candidate,
            reviewer = reviewer,
            approvedText = editedText.trim(),
            decisionType = MemoryDecisionType.EDITED_AND_APPROVED,
            originalText = candidate.draft.text,
        )
    }

    suspend fun approve(
        candidateId: MemoryCandidateId,
        reviewer: String,
    ) {
        require(reviewer.isNotBlank()) { "Reviewer must not be blank" }

        val candidate = requireNotNull(
            store.pending().firstOrNull { it.id == candidateId },
        ) {
            "Unknown memory candidate: ${candidateId.value}"
        }

        promote(
            candidate = candidate,
            reviewer = reviewer,
            approvedText = candidate.draft.text.trim(),
            decisionType = MemoryDecisionType.APPROVED,
            originalText = null,
        )
    }

    private suspend fun promote(
        candidate: PendingMemoryCandidate,
        reviewer: String,
        approvedText: String,
        decisionType: MemoryDecisionType,
        originalText: String?,
    ) {
        val subjectId = EntityId(
            candidate.draft.subjectLabel
                .trim()
                .lowercase()
                .replace(Regex("[^a-z0-9]+"), "-")
                .trim('-'),
        )

        val text = approvedText

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
                    sourceId = anchor.sourceId.value,
                    anchor = "${anchor.variantId.value}:${anchor.locator.hashCode()}",
                    extractionConfidence = 1.0,
                )
            }.toSet(),
        )

        repository.appendFactVersion(
            fact = fact,
            audit = AuditEvent(
                id = "audit-${UUID.randomUUID()}",
                action = "MEMORY_APPROVED",
                targetType = "FACT_VERSION",
                targetId = factId.value,
                occurredAt = now(),
                correlationId = candidate.draft.sessionId.value,
            ),
        )

        store.saveDecision(MemoryDecision(
            candidateId = candidate.id,
            type = decisionType,
            reviewer = reviewer,
            decidedAt = now(),
            originalText = originalText,
            approvedText = approvedText,
        ))

        store.removePending(candidate.id)
    }

    private fun inferPredicate(text: String): String =
        when {
            text.contains(" hosts ", ignoreCase = true) -> "hosts"
            else -> "states"
        }
}
