package kairo.application

import java.time.Instant
import kairo.domain.EvidenceState
import kairo.domain.FactObject
import kairo.domain.KnowledgeScope
import kairo.retrieval.HybridRetriever
import kairo.retrieval.EvidenceMemoryKind
import kairo.retrieval.RetrievalQuery
import kairo.retrieval.SourceExcerpt

sealed interface ValidatedAnswer {
    data class Accepted(
        val answer: KairoAnswer,
    ) : ValidatedAnswer

    data class Rejected(
        val answer: KairoAnswer,
        val reasons: List<String>,
    ) : ValidatedAnswer
}

class AskKairoService(
    private val retriever: HybridRetriever,
    private val reasoningProvider: ReasoningProvider,
    private val answerValidator: AnswerValidator = AnswerValidator(),
    private val sensitiveContentGuard: SensitiveContentGuard =
        SensitiveContentGuard.ALLOW_ALL,
    private val now: () -> Instant = Instant::now,
) {
    suspend fun quick(
        question: String,
    ): KairoAnswer {
        require(question.isNotBlank()) {
            "Question must not be blank"
        }

        val bundle = retriever.retrieve(
            RetrievalQuery(
                text = question,
                scope = KnowledgeScope.MANA_PRODUCTION,
                at = now(),
            ),
        )

        val best =
            bundle.rankedClaims
                .firstOrNull {
                    it.lexicalMatches > 0 &&
                        it.lexicalMatches * 2 >= it.queryTokenCount
                }

        if (best == null) {
            rememberedEvidenceAnswer(bundle.sources)?.let { answer ->
                return answer
            }

            return KairoAnswer(
                text = "I don't know from the available MANA evidence.",
            )
        }

        val value = when (
            val value = best.fact.objectValue
        ) {
            is FactObject.Literal ->
                value.value

            is FactObject.Entity ->
                value.value.value
        }

        return KairoAnswer(
            text = quickAnswerText(
                value = value,
                state = best.fact.state,
                subject = best.fact.subject.value,
                scope = best.fact.scope,
            ),
        )
    }

    suspend fun analyze(
        question: String,
    ): ValidatedAnswer {
        require(question.isNotBlank()) {
            "Question must not be blank"
        }

        if (
            sensitiveContentGuard.decide(question) ==
            SensitiveContentDecision.BLOCK_CLOUD_REASONING
        ) {
            return ValidatedAnswer.Rejected(
                answer = KairoAnswer(
                    text = "Cloud reasoning blocked for sensitive temporary content.",
                ),
                reasons = listOf(
                    "Sensitive temporary content cannot be sent to the reasoning provider.",
                ),
            )
        }

        val at = now()

        val bundle = retriever.retrieve(
            RetrievalQuery(
                text = question,
                scope = KnowledgeScope.MANA_PRODUCTION,
                at = at,
            ),
        )

        val answer = reasoningProvider.analyze(
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

        return when (
            val validation = answerValidator.validate(
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
    }

    private fun quickAnswerText(
        value: String,
        state: EvidenceState,
        subject: String,
        scope: KnowledgeScope,
    ): String =
        when (state) {
            EvidenceState.CONFIRMED -> value
            EvidenceState.OBSERVED -> "Observed${scopeLabel(scope)} for ${subjectLabel(subject)}: $value"
            EvidenceState.PLANNED -> "Planned${scopeLabel(scope)} for ${subjectLabel(subject)}: $value"
            EvidenceState.PROPOSED -> "Proposed${scopeLabel(scope)} for ${subjectLabel(subject)}: $value"
            EvidenceState.HYPOTHESIS -> "Hypothesis${scopeLabel(scope)} for ${subjectLabel(subject)}: $value"
            EvidenceState.VERIFY -> "${subjectLabel(subject)}${scopeLabel(scope)}: $value — requires verification."
            EvidenceState.DEPRECATED -> "Deprecated${scopeLabel(scope)} for ${subjectLabel(subject)}: $value"
            EvidenceState.CONTRADICTED -> "Contradicted${scopeLabel(scope)} for ${subjectLabel(subject)}: $value"
        }

    private fun rememberedEvidenceAnswer(
        sources: List<SourceExcerpt>,
    ): KairoAnswer? {
        val remembered = sources
            .filter { source -> source.kind != null }
            .take(4)

        if (remembered.isEmpty()) return null

        return KairoAnswer(
            text = buildString {
                append("Related prior evidence (not an approved MANA fact):")
                remembered.forEach { source ->
                    append("\n- ")
                    append(
                        when (source.kind) {
                            EvidenceMemoryKind.CONVERSATION -> "Prior conversation"
                            EvidenceMemoryKind.UPLOAD -> "Uploaded evidence"
                            null -> error("Remembered evidence requires a kind")
                        },
                    )
                    append(" [")
                    append(source.sourceId)
                    append("]: ")
                    append(source.text)
                }
            },
        )
    }

    private fun scopeLabel(scope: KnowledgeScope): String =
        if (scope == KnowledgeScope.MANA_PRODUCTION) "" else " [${scope.name}]"

    private fun subjectLabel(subject: String): String =
        subject.replace('-', ' ')
}
