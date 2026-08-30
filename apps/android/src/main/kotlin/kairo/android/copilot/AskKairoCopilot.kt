package kairo.android.copilot

import kairo.application.AskKairoService
import kairo.application.ConversationContinuityService
import kairo.application.KairoAnswer
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger

class ConversationCaptureSession(
    val conversationId: String = UUID.randomUUID().toString(),
) {
    init {
        require(conversationId.isNotBlank()) { "Conversation id must not be blank" }
    }

    private val nextTurnNumber = AtomicInteger(0)

    fun takeTurnNumber(): Int = nextTurnNumber.getAndIncrement()
}

class AskKairoCopilot(
    private val service: AskKairoService,
    private val continuity: ConversationContinuityService? = null,
    private val conversation: ConversationCaptureSession = ConversationCaptureSession(),
) : Copilot {

    override suspend fun ask(
        question: String,
    ): KairoAnswer {
        remember(question)

        return service.quick(question).also { answer ->
            remember(answer.text)
        }
    }

    private suspend fun remember(text: String) {
        continuity?.rememberConversationTurn(
            conversationId = conversation.conversationId,
            turnNumber = conversation.takeTurnNumber(),
            text = text,
        )
    }
}
