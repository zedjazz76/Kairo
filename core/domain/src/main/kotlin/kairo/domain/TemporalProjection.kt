package kairo.domain

import java.time.Instant

data class CurrentBestUnderstanding(
    val current: List<FactVersion>,
    val history: List<FactVersion>,
) : List<FactVersion> by current {
    companion object {
        fun project(
            versions: Iterable<FactVersion>,
            at: Instant = Instant.now(),
        ): CurrentBestUnderstanding {
            val allVersions = versions.toList()
            val retiredFactIds = allVersions
                .asSequence()
                .filter { it.state == EvidenceState.CONTRADICTED || it.state == EvidenceState.DEPRECATED }
                .mapNotNull { it.supersedes }
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

        private val currentEvidenceStates = setOf(EvidenceState.CONFIRMED, EvidenceState.OBSERVED)

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
