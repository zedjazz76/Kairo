package kairo.domain

import java.time.Instant

sealed interface FactObject {
    data class Entity(val value: EntityId) : FactObject

    data class Literal(val value: String) : FactObject {
        init {
            require(value.isNotBlank()) { "Fact literal must not be blank" }
        }
    }
}

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
    val supersedes: FactId? = null,
) {
    init {
        require(predicate.isNotBlank()) { "Fact predicate must not be blank" }
        require(effectiveFrom == null || effectiveTo == null || !effectiveTo.isBefore(effectiveFrom)) {
            "Fact effectiveTo must not be before effectiveFrom"
        }
        require(!state.requiresEvidence() || evidence.isNotEmpty()) {
            "Important active facts require evidence"
        }
    }
}

private fun EvidenceState.requiresEvidence(): Boolean = when (this) {
    EvidenceState.HYPOTHESIS,
    EvidenceState.DEPRECATED,
    EvidenceState.CONTRADICTED,
    -> false

    else -> true
}
