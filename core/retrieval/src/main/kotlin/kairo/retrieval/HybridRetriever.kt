package kairo.retrieval

import kairo.domain.EvidenceState
import kairo.domain.FactObject
import kairo.domain.FactVersion
import kairo.domain.IncidentPattern
import kairo.domain.KnowledgeScope
import kairo.domain.Project
import kairo.domain.Source
import kairo.domain.Workflow

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
    val lexicalMatches: Int = 0,
    val queryTokenCount: Int = 0,
)

data class RetrievedEntity(
    val id: String,
    val label: String,
)

data class SourceExcerpt(
    val sourceId: String,
    val text: String,
    val memoryId: String? = null,
    val kind: EvidenceMemoryKind? = null,
    val score: Int = 0,
)

enum class EvidenceMemoryKind {
    CONVERSATION,
    UPLOAD,
}

data class EvidenceMemoryRecord(
    val id: String,
    val sourceId: String,
    val kind: EvidenceMemoryKind,
    val text: String,
    val capturedAt: java.time.Instant,
    val conversationId: String? = null,
    val turnNumber: Int? = null,
) {
    init {
        require(id.isNotBlank()) { "Evidence memory id must not be blank" }
        require(sourceId.isNotBlank()) { "Evidence memory source id must not be blank" }
        require(text.isNotBlank()) { "Evidence memory text must not be blank" }
        require(turnNumber == null || turnNumber >= 0) { "Turn number must not be negative" }
    }
}

data class RetrievedWorkflow(
    val id: String,
    val label: String,
)

data class RetrievedProject(
    val id: String,
    val label: String,
)

data class ConflictExplanation(
    val description: String,
)

data class EvidenceBundle(
    val entities: List<RetrievedEntity> = emptyList(),
    val rankedClaims: List<RankedFact>,
    val sources: List<SourceExcerpt> = emptyList(),
    val workflows: List<RetrievedWorkflow> = emptyList(),
    val projects: List<RetrievedProject> = emptyList(),
    val incidents: List<IncidentPattern> = emptyList(),
    val conflicts: List<ConflictExplanation> = emptyList(),
    val unknowns: List<String> = emptyList(),
)

class HybridRetriever(
    private val facts: List<FactVersion>,
    private val sources: List<Source> = emptyList(),
    private val evidenceMemory: List<EvidenceMemoryRecord> = emptyList(),
    private val workflows: List<Workflow> = emptyList(),
    private val projects: List<Project> = emptyList(),
    private val incidents: List<IncidentPattern> = emptyList(),
    private val incidentSemanticIndex: SemanticIndex<IncidentPattern> =
        DefaultIncidentSemanticIndex(),
) {
    fun retrieve(query: RetrievalQuery): EvidenceBundle {
        val ranked = facts
            .map { fact ->
                val lexicalMatches =
                    lexicalMatches(
                        fact = fact,
                        query = query,
                    )

                RankedFact(
                    fact = fact,
                    score =
                        score(
                            fact = fact,
                            query = query,
                            lexicalMatches =
                                lexicalMatches,
                        ),
                    lexicalMatches =
                        lexicalMatches,
                    queryTokenCount = tokenize(query.text).size,
                )
            }
            .sortedWith(
                compareByDescending<RankedFact> { it.score }
                    .thenBy { it.fact.id.value },
            )

        return EvidenceBundle(
            rankedClaims = ranked,
            sources = retrieveSources(query),
            workflows = workflows.map(::retrievedWorkflow),
            projects = projects.map(::retrievedProject),
            incidents = incidentSemanticIndex.search(
                query = query.text,
                candidates = incidents,
            ),
            unknowns = projects
                .flatMap { project ->
                    project.openQuestions
                }
                .map { question ->
                    question.question
                }
                .distinct(),
        )
    }

    private fun retrieveSources(query: RetrievalQuery): List<SourceExcerpt> {
        val remembered = evidenceMemory
            .map { record -> record to conceptScore(concepts(query.text), concepts(record.text)) }
            .filter { (_, score) -> score > 0 }
            .sortedWith(
                compareByDescending<Pair<EvidenceMemoryRecord, Int>> { (record, _) -> record.kind == EvidenceMemoryKind.CONVERSATION }
                    .thenByDescending { (_, score) -> score }
                    .thenByDescending { (record, _) -> record.capturedAt }
                    .thenBy { (record, _) -> record.id },
            )
            .map { (record, score) ->
                SourceExcerpt(
                    sourceId = record.sourceId,
                    text = record.text,
                    memoryId = record.id,
                    kind = record.kind,
                    score = score,
                )
            }

        return remembered + sources.map(::sourceExcerpt)
    }

    private fun score(
        fact: FactVersion,
        query: RetrievalQuery,
        lexicalMatches: Int,
    ): Int {
        var score = 0

        if (fact.scope == query.scope) {
            score += 100
        }

        if (fact.state.name.lowercase() in tokenize(query.text)) {
            score += 120
        }

        if (
            fact.scope == KnowledgeScope.INCIDENT &&
            tokenize(query.text).any { token -> token in incidentIntentTerms }
        ) {
            score += 130
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

        score += corroborationScore(fact)

        score += lexicalMatches * 5

        return score
    }
}

private fun lexicalMatches(
    fact: FactVersion,
    query: RetrievalQuery,
): Int {
    val searchableTokens = tokenize(buildString {
        append(fact.subject.value)
        append(' ')
        append(fact.predicate)
        append(' ')
        append(fact.scope.name)
        append(' ')
        append(fact.state.name)
        append(' ')

        when (val value = fact.objectValue) {
            is FactObject.Entity ->
                append(value.value.value)

            is FactObject.Literal ->
                append(value.value)
        }
    })

    return tokenize(query.text).count { token ->
        searchableTokens.any { searchableToken ->
            tokenVariants(token)
                .intersect(tokenVariants(searchableToken))
                .isNotEmpty()
        }
    }
}

private fun tokenVariants(token: String): Set<String> =
    buildSet {
        add(token)

        if (token.length > 3 && token.endsWith('s')) {
            add(token.dropLast(1))
        }

        if (token.length > 4 && token.endsWith("ed")) {
            add(token.dropLast(2))
        }
    }


private fun sourceExcerpt(
    source: Source,
): SourceExcerpt =
    SourceExcerpt(
        sourceId = source.id.value,
        text = "Source ${source.id.value}",
    )

private fun retrievedWorkflow(
    workflow: Workflow,
): RetrievedWorkflow =
    RetrievedWorkflow(
        id = workflow.id.value,
        label = workflow.name,
    )

private fun retrievedProject(
    project: Project,
): RetrievedProject =
    RetrievedProject(
        id = project.id.value,
        label = project.name,
    )

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



private fun corroborationScore(
    fact: FactVersion,
): Int =
    when {
        fact.evidence.size <= 1 -> 0
        else -> (fact.evidence.size - 1) * 10
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
                "disappear",
                "disappeared",
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
                "viewer",
            )
        }
    ) {
        tokens += "interpretation"
    }

    if (tokens.any { it in setOf("image", "images", "study", "studies") }) {
        tokens += "clinical-image"
    }

    return tokens
}

private val stopWords =
    setOf(
        "a",
        "about",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "by",
        "do",
        "does",
        "for",
        "from",
        "how",
        "i",
        "in",
        "is",
        "it",
        "know",
        "of",
        "on",
        "or",
        "the",
        "to",
        "we",
        "what",
        "when",
        "where",
        "which",
        "who",
        "why",
        "with",
    )

private val incidentIntentTerms =
    setOf(
        "error",
        "failure",
        "incident",
        "issue",
        "troubleshoot",
        "troubleshooting",
    )

private fun tokenize(text: String): Set<String> =
    text
        .lowercase()
        .split(Regex("[^a-z0-9]+"))
        .filter { token ->
            token.length > 1 &&
                token !in stopWords
        }
        .toSet()
