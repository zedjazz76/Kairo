package kairo.domain

import java.time.Instant
import java.util.Collections
import java.util.LinkedHashSet

sealed interface FactObject {
    data class Entity(val value: EntityId) : FactObject

    data class Literal(val value: String) : FactObject {
        init {
            require(value.isNotBlank()) { "Fact literal must not be blank" }
        }
    }
}

class FactVersion(
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
    evidence: Set<EvidenceRef>,
    val supersedes: FactId? = null,
) {
    val evidence: Set<EvidenceRef> = immutableSetSnapshot(evidence)

    init {
        require(predicate.isNotBlank()) { "Fact predicate must not be blank" }
        require(effectiveFrom == null || effectiveTo == null || !effectiveTo.isBefore(effectiveFrom)) {
            "Fact effectiveTo must not be before effectiveFrom"
        }
        require(!state.requiresEvidence() || evidence.isNotEmpty()) {
            "Important active facts require evidence"
        }
    }

    fun copy(
        id: FactId = this.id,
        subject: EntityId = this.subject,
        predicate: String = this.predicate,
        objectValue: FactObject = this.objectValue,
        scope: KnowledgeScope = this.scope,
        state: EvidenceState = this.state,
        effectiveFrom: Instant? = this.effectiveFrom,
        effectiveTo: Instant? = this.effectiveTo,
        recordedAt: Instant = this.recordedAt,
        lastValidatedAt: Instant? = this.lastValidatedAt,
        evidence: Set<EvidenceRef> = this.evidence,
        supersedes: FactId? = this.supersedes,
    ): FactVersion = FactVersion(
        id = id,
        subject = subject,
        predicate = predicate,
        objectValue = objectValue,
        scope = scope,
        state = state,
        effectiveFrom = effectiveFrom,
        effectiveTo = effectiveTo,
        recordedAt = recordedAt,
        lastValidatedAt = lastValidatedAt,
        evidence = evidence,
        supersedes = supersedes,
    )

    override fun equals(other: Any?): Boolean =
        other is FactVersion &&
            id == other.id &&
            subject == other.subject &&
            predicate == other.predicate &&
            objectValue == other.objectValue &&
            scope == other.scope &&
            state == other.state &&
            effectiveFrom == other.effectiveFrom &&
            effectiveTo == other.effectiveTo &&
            recordedAt == other.recordedAt &&
            lastValidatedAt == other.lastValidatedAt &&
            evidence == other.evidence &&
            supersedes == other.supersedes

    override fun hashCode(): Int = listOf(
        id,
        subject,
        predicate,
        objectValue,
        scope,
        state,
        effectiveFrom,
        effectiveTo,
        recordedAt,
        lastValidatedAt,
        evidence,
        supersedes,
    ).hashCode()

    override fun toString(): String =
        "FactVersion(id=$id, subject=$subject, predicate=$predicate, objectValue=$objectValue, " +
            "scope=$scope, state=$state, effectiveFrom=$effectiveFrom, effectiveTo=$effectiveTo, " +
            "recordedAt=$recordedAt, lastValidatedAt=$lastValidatedAt, evidence=$evidence, " +
            "supersedes=$supersedes)"
}

private fun <T> immutableSetSnapshot(values: Set<T>): Set<T> =
    Collections.unmodifiableSet(LinkedHashSet(values))

private fun EvidenceState.requiresEvidence(): Boolean = when (this) {
    EvidenceState.HYPOTHESIS,
    EvidenceState.DEPRECATED,
    EvidenceState.CONTRADICTED,
    -> false

    else -> true
}
