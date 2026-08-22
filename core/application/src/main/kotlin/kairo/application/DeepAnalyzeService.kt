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
)

class DeepAnalyzeService(
    private val retriever: HybridRetriever,
    private val traceWorkflowService: TraceWorkflowService? = null,
    private val workflowId: WorkflowId? = null,
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
                RankedFailureDomain(
                    name = failureDomainFor(
                        rootCause = incident.rootCause,
                        symptom = incident.symptom,
                    ),
                    score = 100 - index,
                    rationale = incident.rootCause,
                )
            }

        val traceDomains =
            traceFailureDomains(
                question = question,
            )

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

        val nextBestAction =
            traceNextBestAction(
                question = question,
            )
                ?: bundle.incidents
                    .firstOrNull()
                    ?.resolution
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
