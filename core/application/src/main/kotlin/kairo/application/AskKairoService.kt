package kairo.application

import java.time.Instant
import kairo.domain.EvidenceState
import kairo.domain.FactObject
import kairo.domain.KnowledgeScope
import kairo.retrieval.HybridRetriever
import kairo.retrieval.RetrievalQuery

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

        val best = bundle.rankedClaims.firstOrNull()

        if (best == null) {
            return KairoAnswer(
                text = "I don't know from the available MANA evidence.",
            )
        }

        val text = when (
            val value = best.fact.objectValue
        ) {
            is FactObject.Literal ->
                value.value

            is FactObject.Entity ->
                value.value.value
        }

        return KairoAnswer(
            text = text,
        )
    }

    suspend fun analyze(
        question: String,
    ): ValidatedAnswer {
        require(question.isNotBlank()) {
            "Question must not be blank"
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
}
