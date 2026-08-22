package kairo.application

import kairo.domain.EvidenceRef
import kairo.domain.EvidenceState
import kairo.retrieval.HybridRetriever
import kairo.retrieval.RetrievalQuery
import kairo.domain.KnowledgeScope
import kairo.domain.WorkflowId

data class DiagnosticClaim(
    val text: String,
    val state: EvidenceState,
    val evidenceRefs: Set<EvidenceRef>,
)

data class RankedFailureDomain(
    val name: String,
    val score: Int,
    val rationale: String,
)

data class DeepAnalysisResult(
    val failureDomains: List<RankedFailureDomain>,
    val nextBestAction: String?,
    val claims: List<DiagnosticClaim>,
    val modelEnrichment: ValidatedAnswer? = null,
)

class DeepAnalyzeService(
    private val retriever: HybridRetriever,
    private val traceWorkflowService: TraceWorkflowService? = null,
    private val workflowId: WorkflowId? = null,
    private val reasoningProvider: ReasoningProvider? = null,
    private val answerValidator: AnswerValidator = AnswerValidator(),
    private val now: () -> java.time.Instant = java.time.Instant::now,
) {

    fun deepAnalyze(
        question: String,
    ): DeepAnalysisResult {
        require(question.isNotBlank()) {
            "Question must not be blank"
        }

        val bundle = retriever.retrieve(
            RetrievalQuery(
                text = question,
                scope = KnowledgeScope.MANA_PRODUCTION,
            ),
        )

        val incidentDomains =
            bundle.incidents.mapIndexed { index, incident ->
                val domain =
                    failureDomainFor(
                        rootCause = incident.rootCause,
                        symptom = incident.symptom,
                    )

                val evidenceBoost =
                    when (domain) {
                        "IDENTITY_OR_DEMOGRAPHICS" -> 40
                        "ROUTING" -> 20
                        else -> 0
                    }

                RankedFailureDomain(
                    name = domain,
                    score = 100 + evidenceBoost - index,
                    rationale = incident.rootCause,
                )
            }

        val traceDomains =
            traceFailureDomains(
                question = question,
            ) + traceIdentifierFailureDomains()

        val reinforcedDomains =
            reinforceFailureDomains(
                incidentDomains = incidentDomains,
                traceDomains = traceDomains,
            )

        val incidentClaims =
            bundle.incidents.map { incident ->
                DiagnosticClaim(
                    text = incident.rootCause,
                    state = incident.evidenceState,
                    evidenceRefs =
                        incident.evidenceAnchors
                            .map { anchor ->
                                EvidenceRef(
                                    anchor.sourceId.value,
                                )
                            }
                            .toSet(),
                )
            }

        val failureDomains =
            when {
                reinforcedDomains.isNotEmpty() ->
                    reinforcedDomains

                incidentDomains.isNotEmpty() ->
                    incidentDomains

                traceDomains.isNotEmpty() ->
                    traceDomains

                else ->
                    listOf(
                        RankedFailureDomain(
                            name = "UNKNOWN_WORKFLOW_FAILURE",
                            score = 1,
                            rationale =
                                "No matching incident or workflow evidence was retrieved.",
                        ),
                    )
            }

        val claims =
            if (incidentClaims.isNotEmpty()) {
                incidentClaims
            } else {
                listOf(
                    DiagnosticClaim(
                        text =
                            "The failure domain is not yet supported by retrieved evidence.",
                        state = EvidenceState.HYPOTHESIS,
                        evidenceRefs = emptySet(),
                    ),
                )
            }

        val topFailureDomain =
            failureDomains
                .maxByOrNull { it.score }
                ?.name

        val incidentAction =
            bundle.incidents
                .firstOrNull()
                ?.resolution

        val nextBestAction =
            when (topFailureDomain) {
                "IDENTITY_OR_DEMOGRAPHICS" ->
                    incidentAction
                        ?: traceIdentifierNextBestAction()
                        ?: traceNextBestAction(
                            question = question,
                        )

                else ->
                    traceNextBestAction(
                        question = question,
                    )
                        ?: incidentAction
            }
                ?: "Validate the first unresolved workflow hop."

        return DeepAnalysisResult(
            failureDomains =
                failureDomains.sortedByDescending {
                    it.score
                },
            nextBestAction = nextBestAction,
            claims = claims,
        )
    }

    private fun traceIdentifierFailureDomains():
        List<RankedFailureDomain> {
        val service =
            traceWorkflowService
                ?: return emptyList()

        val id =
            workflowId
                ?: return emptyList()

        val at = now()

        val trace = service.trace(
            workflowId = id,
            atTime = at,
            knowledgeAsOf = at,
        )

        val unresolved =
            trace.identifierMappings.filter { mapping ->
                mapping.reconciliationStatus ==
                    IdentifierReconciliationStatus.UNVERIFIED ||
                    mapping.reconciliationStatus ==
                    IdentifierReconciliationStatus.MISSING
            }

        if (unresolved.isEmpty()) {
            return emptyList()
        }

        return listOf(
            RankedFailureDomain(
                name = "IDENTITY_OR_DEMOGRAPHICS",
                score = 160,
                rationale =
                    "Trace contains unresolved identifier reconciliation.",
            ),
        )
    }

    private fun traceIdentifierNextBestAction(): String? {
        val service =
            traceWorkflowService
                ?: return null

        val id =
            workflowId
                ?: return null

        val at = now()

        val trace = service.trace(
            workflowId = id,
            atTime = at,
            knowledgeAsOf = at,
        )

        val unresolved =
            trace.identifierMappings.firstOrNull { mapping ->
                mapping.reconciliationStatus ==
                    IdentifierReconciliationStatus.UNVERIFIED ||
                    mapping.reconciliationStatus ==
                    IdentifierReconciliationStatus.MISSING
            }
                ?: return null

        return "Validate identifier reconciliation from " +
            "${unresolved.sourceSystem} ${unresolved.sourceIdentifier} " +
            "to ${unresolved.targetSystem} ${unresolved.targetIdentifier}."
    }

    private fun traceFailureDomains(
        question: String,
    ): List<RankedFailureDomain> {
        val service =
            traceWorkflowService
                ?: return emptyList()

        val id =
            workflowId
                ?: return emptyList()

        val now =
            java.time.Instant.now()

        val trace = service.trace(
            workflowId = id,
            atTime = now,
            knowledgeAsOf = now,
        )

        val terms =
            question
                .lowercase()
                .split(
                    Regex("[^a-z0-9]+"),
                )
                .filter {
                    it.length >= 4
                }
                .toSet()

        return trace.current.hops
            .flatMap { hop ->
                val searchable =
                    "${hop.name} ${hop.system}".lowercase()

                val relevance =
                    terms.count { term ->
                        term in searchable
                    }

                hop.failureDomains.map { domain ->
                    RankedFailureDomain(
                        name = domain,
                        score = 50 + relevance,
                        rationale =
                            "Trace hop ${hop.system} / ${hop.name}",
                    )
                }
            }
    }

    private fun reinforceFailureDomains(
        incidentDomains: List<RankedFailureDomain>,
        traceDomains: List<RankedFailureDomain>,
    ): List<RankedFailureDomain> {
        if (
            incidentDomains.isEmpty() ||
            traceDomains.isEmpty()
        ) {
            return emptyList()
        }

        val traceByNormalized =
            traceDomains.groupBy {
                normalizeFailureDomain(it.name)
            }

        return incidentDomains.map { incident ->
            val matches =
                traceByNormalized[
                    normalizeFailureDomain(
                        incident.name,
                    )
                ].orEmpty()

            if (matches.isEmpty()) {
                incident
            } else {
                RankedFailureDomain(
                    name =
                        preferredFailureDomainName(
                            incident = incident.name,
                            trace = matches.first().name,
                        ),
                    score =
                        incident.score +
                            25 +
                            matches.maxOf { it.score },
                    rationale =
                        "${incident.rationale}; reinforced by ${matches.first().rationale}",
                )
            }
        }
            .sortedByDescending {
                it.score
            }
    }

    private fun normalizeFailureDomain(
        domain: String,
    ): String =
        when (domain) {
            "ROUTING",
            "WORKLIST_OR_ROUTING" ->
                "ROUTING"

            "IDENTITY",
            "DEMOGRAPHICS",
            "IDENTITY_OR_DEMOGRAPHICS" ->
                "IDENTITY_OR_DEMOGRAPHICS"

            else ->
                domain
        }

    private fun preferredFailureDomainName(
        incident: String,
        trace: String,
    ): String =
        when {
            trace == "WORKLIST_OR_ROUTING" ->
                trace

            else ->
                incident
        }

    private fun traceNextBestAction(
        question: String,
    ): String? {
        val service =
            traceWorkflowService
                ?: return null

        val id =
            workflowId
                ?: return null

        val now =
            java.time.Instant.now()

        val trace = service.trace(
            workflowId = id,
            atTime = now,
            knowledgeAsOf = now,
        )

        val terms =
            question
                .lowercase()
                .split(
                    Regex("[^a-z0-9]+"),
                )
                .filter {
                    it.length >= 4
                }
                .toSet()

        val matchedHop =
            trace.current.hops
                .map { hop ->
                    val searchable =
                        listOf(
                            hop.name,
                            hop.system,
                        )
                            .joinToString(" ")
                            .lowercase()

                    val score =
                        terms.count { term ->
                            term in searchable
                        }

                    hop to score
                }
                .sortedByDescending {
                    it.second
                }
                .firstOrNull {
                    it.second > 0
                }
                ?.first

        return matchedHop?.let { hop ->
            "Verify ${hop.system} at the ${hop.name} hop."
        }
    }

    suspend fun deepAnalyzeWithReasoning(
        question: String,
    ): DeepAnalysisResult {
        val deterministic =
            deepAnalyze(question)

        val provider =
            reasoningProvider
                ?: return deterministic

        val at = now()

        val bundle = retriever.retrieve(
            RetrievalQuery(
                text = question,
                scope = KnowledgeScope.MANA_PRODUCTION,
                at = at,
            ),
        )

        val answer =
            provider.analyze(
                ReasoningPacket(
                    question = question,
                    evidence = bundle,
                    confirmed = bundle.rankedClaims.filter {
                        it.fact.state == EvidenceState.CONFIRMED
                    },
                    observed = bundle.rankedClaims.filter {
                        it.fact.state == EvidenceState.OBSERVED
                    },
                    planned = bundle.rankedClaims.filter {
                        it.fact.state == EvidenceState.PLANNED
                    },
                    hypotheses = bundle.rankedClaims.filter {
                        it.fact.state == EvidenceState.HYPOTHESIS ||
                            it.fact.state == EvidenceState.VERIFY ||
                            it.fact.state == EvidenceState.PROPOSED
                    },
                    unknowns = bundle.unknowns,
                    prohibitedActions = listOf(
                        "Do not perform production clinical-system writes.",
                        "Do not present unsupported MANA claims as facts.",
                        "Do not convert planned or project state into current production truth.",
                    ),
                ),
            )

        val enrichment =
            when (
                val validation =
                    answerValidator.validate(
                        answer = answer,
                        bundle = bundle,
                        at = at,
                    )
            ) {
                ValidationResult.Accepted ->
                    ValidatedAnswer.Accepted(
                        answer = answer,
                    )

                is ValidationResult.Rejected ->
                    ValidatedAnswer.Rejected(
                        answer = answer,
                        reasons = validation.reasons,
                    )
            }

        return deterministic.copy(
            modelEnrichment = enrichment,
        )
    }

    private fun failureDomainFor(
        rootCause: String,
        symptom: String,
    ): String {
        val combined =
            "$rootCause $symptom".lowercase()

        return when {
            "routing" in combined ->
                "ROUTING"

            "worklist" in combined ||
                "dmwl" in combined ->
                "WORKLIST"

            "dicom" in combined ->
                "DICOM_CONNECTIVITY"

            "hl7" in combined ||
                "order" in combined ->
                "ORDER_OR_INTERFACE"

            "identity" in combined ||
                "mrn" in combined ||
                "demographic" in combined ->
                "IDENTITY_OR_DEMOGRAPHICS"

            else ->
                "WORKFLOW_OR_CONNECTIVITY"
        }
    }
}
