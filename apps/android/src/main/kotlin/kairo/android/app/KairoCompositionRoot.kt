package kairo.android.app

import kairo.android.copilot.AskKairoCopilot
import kairo.android.copilot.Copilot
import kairo.android.copilot.ConversationCaptureSession
import kairo.android.tunnel.CoreCommandDispatcher
import kairo.android.tunnel.SearchKnowledgeCoreCommandDispatcher
import kairo.application.AskKairoService
import kairo.application.ConversationContinuityService
import kairo.application.EvidenceMemoryStore
import kairo.application.FactQuery
import kairo.application.KnowledgeRepository
import kairo.application.KairoAnswer
import kairo.application.ReasoningPacket
import kairo.application.ReasoningProvider
import kairo.domain.FactVersion
import kairo.retrieval.HybridRetriever
import kairo.retrieval.EvidenceMemoryRecord

class KairoCompositionRoot private constructor(
    val copilot: Copilot,
    val coreCommandDispatcher: CoreCommandDispatcher,
) {

    companion object {

        fun empty(): KairoCompositionRoot =
            fromFacts(
                facts = emptyList(),
            )

        suspend fun fromRepository(
            repository: KnowledgeRepository,
            conversation: ConversationCaptureSession = ConversationCaptureSession(),
        ): KairoCompositionRoot {
            val facts =
                repository.retrievalUnderstanding(
                    FactQuery(),
                )

            val evidenceStore = repository as? EvidenceMemoryStore

            return fromFacts(
                facts = facts,
                evidenceMemory = evidenceStore?.all().orEmpty(),
                continuity = evidenceStore?.let(::ConversationContinuityService),
                conversation = conversation,
            )
        }

        fun fromFacts(
            facts: List<FactVersion>,
            evidenceMemory: List<EvidenceMemoryRecord> = emptyList(),
            continuity: ConversationContinuityService? = null,
            conversation: ConversationCaptureSession = ConversationCaptureSession(),
        ): KairoCompositionRoot {
            val retriever =
                HybridRetriever(
                    facts = facts,
                    evidenceMemory = evidenceMemory,
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
                        continuity = continuity,
                        conversation = conversation,
                    ),
                coreCommandDispatcher = SearchKnowledgeCoreCommandDispatcher(retriever),
            )
        }
    }
}
