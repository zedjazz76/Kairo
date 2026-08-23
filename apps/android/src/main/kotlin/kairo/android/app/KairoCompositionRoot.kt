package kairo.android.app

import kairo.android.copilot.AskKairoCopilot
import kairo.android.copilot.Copilot
import kairo.application.AskKairoService
import kairo.application.FactQuery
import kairo.application.KnowledgeRepository
import kairo.application.KairoAnswer
import kairo.application.ReasoningPacket
import kairo.application.ReasoningProvider
import kairo.domain.FactVersion
import kairo.retrieval.HybridRetriever

class KairoCompositionRoot private constructor(
    val copilot: Copilot,
) {

    companion object {

        fun empty(): KairoCompositionRoot =
            fromFacts(
                facts = emptyList(),
            )

        suspend fun fromRepository(
            repository: KnowledgeRepository,
        ): KairoCompositionRoot {
            val facts =
                repository.currentUnderstanding(
                    FactQuery(),
                )

            return fromFacts(
                facts = facts,
            )
        }

        fun fromFacts(
            facts: List<FactVersion>,
        ): KairoCompositionRoot {
            val retriever =
                HybridRetriever(
                    facts = facts,
                )

            val reasoningProvider =
                object : ReasoningProvider {
                    override suspend fun analyze(
                        packet: ReasoningPacket,
                    ): KairoAnswer {
                        error(
                            "Cloud reasoning is not configured in the Android composition root.",
                        )
                    }
                }

            val service =
                AskKairoService(
                    retriever = retriever,
                    reasoningProvider = reasoningProvider,
                )

            return KairoCompositionRoot(
                copilot =
                    AskKairoCopilot(
                        service = service,
                    ),
            )
        }
    }
}
