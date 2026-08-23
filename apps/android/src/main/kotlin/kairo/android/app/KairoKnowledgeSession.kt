package kairo.android.app

import kairo.android.capture.KnowledgeCapture
import kairo.android.capture.KnowledgeCaptureRequest
import kairo.android.copilot.Copilot
import kairo.application.KnowledgeRepository
import kairo.platform.db.RoomKnowledgeRepository

class KairoKnowledgeSession(
    private val repository: KnowledgeRepository,
) {

    private var currentCopilot: Copilot =
        KairoCompositionRoot
            .empty()
            .copilot

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
                )

            override suspend fun save(
                request: KnowledgeCaptureRequest,
            ) {
                delegate.save(request)

                currentCopilot =
                    KairoCompositionRoot
                        .fromRepository(
                            repository = repository,
                        )
                        .copilot

                revision += 1
            }
        }

    suspend fun load() {
        currentCopilot =
            KairoCompositionRoot
                .fromRepository(
                    repository = repository,
                )
                .copilot
    }
}
