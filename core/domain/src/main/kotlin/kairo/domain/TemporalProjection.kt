package kairo.domain

import java.time.Instant
import java.util.Collections
import java.util.ArrayList

class CurrentBestUnderstanding(
    current: List<FactVersion>,
    history: List<FactVersion>,
) : List<FactVersion> by immutableListSnapshot(current) {
    val current: List<FactVersion> = immutableListSnapshot(current)
    val history: List<FactVersion> = immutableListSnapshot(history)

    companion object {
        fun project(
            versions: Iterable<FactVersion>,
            at: Instant = Instant.now(),
        ): CurrentBestUnderstanding {
            val allVersions = versions.toList()
            val versionsById = allVersions.associateBy { it.id }
            val retiredFactIds = allVersions
                .asSequence()
                .mapNotNull { successor ->
                    val predecessor = successor.supersedes?.let(versionsById::get) ?: return@mapNotNull null
                    predecessor.id.takeIf { successor.retires(predecessor, at) }
                }
                .toSet()
            val current = allVersions
                .asSequence()
                .filter { it.id !in retiredFactIds }
                .filter { it.isCurrentAt(at) }
                .groupBy { FactKey(it.subject, it.predicate) }
                .values
                .map { candidates -> candidates.maxWith(currentFactOrder) }
                .sortedWith(historyOrder)

            return CurrentBestUnderstanding(
                current = current,
                history = allVersions.sortedWith(historyOrder),
            )
        }

        private fun FactVersion.isCurrentAt(at: Instant): Boolean =
            state in currentEvidenceStates &&
                (effectiveFrom == null || !effectiveFrom.isAfter(at)) &&
                (effectiveTo == null || effectiveTo.isAfter(at))

        private fun FactVersion.retires(predecessor: FactVersion, at: Instant): Boolean =
            scope == predecessor.scope &&
                recordedAt.isAfter(predecessor.recordedAt) &&
                (isCurrentAt(at) || state in terminalEvidenceStates)

        private val currentEvidenceStates = setOf(EvidenceState.CONFIRMED, EvidenceState.OBSERVED)

        private val terminalEvidenceStates = setOf(EvidenceState.CONTRADICTED, EvidenceState.DEPRECATED)

        private val currentFactOrder = compareBy<FactVersion> { it.scope.currentPriority }
            .thenBy { it.state.currentPriority }
            .thenBy { it.lastValidatedAt ?: it.recordedAt }
            .thenBy { it.recordedAt }
            .thenBy { it.id.value }

        private val historyOrder = compareBy<FactVersion> { it.recordedAt }
            .thenBy { it.id.value }
    }

    private data class FactKey(val subject: EntityId, val predicate: String)
}

private fun <T> immutableListSnapshot(values: List<T>): List<T> =
    Collections.unmodifiableList(ArrayList(values))

private val KnowledgeScope.currentPriority: Int
    get() = when (this) {
        KnowledgeScope.MANA_PRODUCTION -> 5
        KnowledgeScope.PRODUCT -> 4
        KnowledgeScope.PROJECT -> 3
        KnowledgeScope.INCIDENT -> 2
        KnowledgeScope.EXTERNAL_RESEARCH -> 1
    }

private val EvidenceState.currentPriority: Int
    get() = when (this) {
        EvidenceState.CONFIRMED -> 2
        EvidenceState.OBSERVED -> 1
        else -> 0
    }
