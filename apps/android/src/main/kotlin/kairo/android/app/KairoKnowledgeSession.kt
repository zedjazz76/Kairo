package kairo.android.app

import kairo.android.capture.KnowledgeCapture
import kairo.android.capture.KnowledgeCaptureRequest
import kairo.android.copilot.Copilot
import kairo.application.DeepAnalyzeService
import kairo.application.KnowledgeRepository
import kairo.application.MemoryCandidateId
import kairo.application.MemoryInboxService
import kairo.application.FactQuery
import kairo.domain.EvidenceRef
import kairo.retrieval.HybridRetriever
import kairo.platform.db.RoomKnowledgeRepository

class KairoKnowledgeSession(
    private val repository: KnowledgeRepository,
) {

    private var currentCopilot: Copilot =
        KairoCompositionRoot
            .empty()
            .copilot

    val memoryInbox =
        MemoryInboxService(
            repository = repository,
        )

    var revision: Int = 0
        private set

    val copilot: Copilot
        get() = currentCopilot

    val knowledgeCapture: KnowledgeCapture =
        object : KnowledgeCapture {
            private val delegate =
                RoomKnowledgeCapture(
                    repository =
                        repository as RoomKnowledgeRepository,
                    memoryInbox = memoryInbox,
                )

            override suspend fun save(
                request: KnowledgeCaptureRequest,
            ) {
                delegate.save(request)

                refreshCopilot()
            }
        }

    suspend fun approveMemory(
        candidateId: MemoryCandidateId,
        reviewer: String,
    ) {
        memoryInbox.approve(
            candidateId = candidateId,
            reviewer = reviewer,
        )

        refreshCopilot()
    }

    suspend fun deepAnalyze(
        question: String,
    ): String {
        val facts =
            repository.currentUnderstanding(
                FactQuery(),
            )

        val result =
            DeepAnalyzeService(
                retriever =
                    HybridRetriever(
                        facts = facts,
                    ),
            ).deepAnalyze(question)

        val topDomain =
            result.failureDomains
                .firstOrNull()
                ?.name
                ?: "UNKNOWN_WORKFLOW_FAILURE"

        return buildString {
            append(topDomain)
            result.nextBestAction?.let {
                append("\n")
                append(it)
            }
        }
    }

    suspend fun evidenceSources(): List<EvidenceRef> =
        repository.currentUnderstanding(
            FactQuery(),
        )
            .flatMap { fact -> fact.evidence }
            .distinct()

    suspend fun load() {
        currentCopilot =
            KairoCompositionRoot
                .fromRepository(
                    repository = repository,
                )
                .copilot
    }

    private suspend fun refreshCopilot() {
        currentCopilot =
            KairoCompositionRoot
                .fromRepository(
                    repository = repository,
                )
                .copilot

        revision += 1
    }
}
