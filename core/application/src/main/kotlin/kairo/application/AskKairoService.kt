package kairo.application

import kairo.domain.FactObject
import kairo.domain.KnowledgeScope
import kairo.retrieval.HybridRetriever
import kairo.retrieval.RetrievalQuery

class AskKairoService(
    private val retriever: HybridRetriever,
    private val reasoningProvider: ReasoningProvider,
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
}
