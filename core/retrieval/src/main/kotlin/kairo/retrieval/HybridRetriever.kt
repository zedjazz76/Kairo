package kairo.retrieval

import kairo.domain.EvidenceState
import kairo.domain.FactObject
import kairo.domain.FactVersion
import kairo.domain.IncidentPattern
import kairo.domain.KnowledgeScope

data class RetrievalQuery(
    val text: String,
    val scope: KnowledgeScope,
    val at: java.time.Instant = java.time.Instant.now(),
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
    val incidents: List<IncidentPattern> = emptyList(),
)

class HybridRetriever(
    private val facts: List<FactVersion>,
    private val incidents: List<IncidentPattern> = emptyList(),
    private val incidentSemanticIndex: SemanticIndex<IncidentPattern> =
        DefaultIncidentSemanticIndex(),
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
            incidents = incidentSemanticIndex.search(
                query = query.text,
                candidates = incidents,
            ),
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

        score += temporalScore(
            fact = fact,
            at = query.at,
        )

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

        val queryTokens = tokenize(query.text)

        score += queryTokens.count { token ->
            searchableText.contains(token)
        } * 5

        return score
    }
}

private class DefaultIncidentSemanticIndex :
    SemanticIndex<IncidentPattern> {

    override fun search(
        query: String,
        candidates: List<IncidentPattern>,
    ): List<IncidentPattern> {
        val queryConcepts = concepts(query)

        return candidates
            .map { incident ->
                val incidentText = buildString {
                    append(incident.symptom)
                    append(' ')
                    append(incident.rootCause)
                    append(' ')
                    append(incident.resolution)
                    append(' ')
                    append(incident.prevention)
                }

                incident to conceptScore(
                    queryConcepts,
                    concepts(incidentText),
                )
            }
            .filter { (_, score) -> score > 0 }
            .sortedWith(
                compareByDescending<Pair<IncidentPattern, Int>> {
                    it.second
                }.thenBy {
                    it.first.id.value
                },
            )
            .map { it.first }
    }
}


private fun temporalScore(
    fact: FactVersion,
    at: java.time.Instant,
): Int {
    val startsAfterQuery =
        fact.effectiveFrom?.isAfter(at) == true

    val endedBeforeQuery =
        fact.effectiveTo?.isBefore(at) == true

    return when {
        startsAfterQuery -> -80
        endedBeforeQuery -> -80
        else -> 60
    }
}

private fun conceptScore(
    query: Set<String>,
    candidate: Set<String>,
): Int =
    query.count { it in candidate }

private fun concepts(text: String): Set<String> {
    val tokens = tokenize(text).toMutableSet()

    if (
        tokens.any {
            it in setOf(
                "fail",
                "failing",
                "failed",
                "missing",
                "not",
            )
        }
    ) {
        tokens += "delivery-failure"
    }

    if (
        tokens.any {
            it in setOf(
                "reach",
                "arrive",
                "arriving",
                "routing",
                "destination",
            )
        }
    ) {
        tokens += "delivery-failure"
    }

    if (
        tokens.any {
            it in setOf(
                "interpret",
                "interpretation",
                "reading",
            )
        }
    ) {
        tokens += "interpretation"
    }

    return tokens
}

private fun tokenize(text: String): Set<String> =
    text
        .lowercase()
        .split(Regex("[^a-z0-9]+"))
        .filter { it.length > 1 }
        .toSet()
