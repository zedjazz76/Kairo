package kairo.android.app

import kairo.android.copilot.AskKairoCopilot
import kairo.android.copilot.Copilot
import kairo.application.AskKairoService
import kairo.application.KairoAnswer
import kairo.application.ReasoningPacket
import kairo.application.ReasoningProvider
import kairo.retrieval.HybridRetriever

class KairoCompositionRoot private constructor(
    val copilot: Copilot,
) {

    companion object {

        fun empty(): KairoCompositionRoot {
            val retriever =
                HybridRetriever(
                    facts = emptyList(),
                )

            val reasoningProvider =
                object : ReasoningProvider {
                    override suspend fun analyze(
                        packet: ReasoningPacket,
                    ): KairoAnswer {
                        error(
                            "Cloud reasoning is not configured in the empty Android composition root.",
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
