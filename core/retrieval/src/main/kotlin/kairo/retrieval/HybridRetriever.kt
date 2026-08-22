package kairo.retrieval

import kairo.domain.EvidenceState
import kairo.domain.FactObject
import kairo.domain.FactVersion
import kairo.domain.KnowledgeScope

data class RetrievalQuery(
    val text: String,
    val scope: KnowledgeScope,
) {
    init {
        require(text.isNotBlank()) { "Retrieval query text must not be blank" }
    }
}

data class RankedFact(
    val fact: FactVersion,
    val score: Int,
)

data class RetrievalResult(
    val rankedClaims: List<RankedFact>,
)

class HybridRetriever(
    private val facts: List<FactVersion>,
) {
    fun retrieve(query: RetrievalQuery): RetrievalResult {
        val ranked = facts
            .map { fact ->
                RankedFact(
                    fact = fact,
                    score = score(fact, query),
                )
            }
            .sortedWith(
                compareByDescending<RankedFact> { it.score }
                    .thenBy { it.fact.id.value },
            )

        return RetrievalResult(
            rankedClaims = ranked,
        )
    }

    private fun score(
        fact: FactVersion,
        query: RetrievalQuery,
    ): Int {
        var score = 0

        if (fact.scope == query.scope) {
            score += 100
        }

        score += when (fact.state) {
            EvidenceState.CONFIRMED -> 40
            EvidenceState.OBSERVED -> 30
            EvidenceState.PLANNED -> 20
            EvidenceState.PROPOSED -> 15
            EvidenceState.VERIFY -> 10
            EvidenceState.HYPOTHESIS -> 5
            EvidenceState.DEPRECATED -> -20
            EvidenceState.CONTRADICTED -> -40
        }

        val searchableText = buildString {
            append(fact.subject.value)
            append(' ')
            append(fact.predicate)
            append(' ')

            when (val value = fact.objectValue) {
                is FactObject.Entity -> append(value.value.value)
                is FactObject.Literal -> append(value.value)
            }
        }.lowercase()

        val queryTokens = query.text
            .lowercase()
            .split(Regex("[^a-z0-9]+"))
            .filter { it.length > 1 }
            .toSet()

        score += queryTokens.count { token ->
            searchableText.contains(token)
        } * 5

        return score
    }
}
