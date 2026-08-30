package kairo.android.copilot

import kairo.application.AskKairoService
import kairo.application.ConversationContinuityService
import kairo.application.InMemoryEvidenceMemoryStore
import kairo.application.KairoAnswer
import kairo.application.ReasoningPacket
import kairo.application.ReasoningProvider
import kairo.retrieval.EvidenceMemoryKind
import kairo.retrieval.HybridRetriever
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test

class AskKairoCopilotTest {

    @Test
    fun adapter_is_wired_to_core_application_module() {
        Class.forName(
            "kairo.application.AskKairoService",
        )
    }

    @Test
    fun user_and_assistant_turns_are_automatically_captured_as_conversation_evidence() =
        runBlocking {
            val store = InMemoryEvidenceMemoryStore()
            val copilot = AskKairoCopilot(
                service = AskKairoService(
                    retriever = HybridRetriever(facts = emptyList()),
                    reasoningProvider = object : ReasoningProvider {
                        override suspend fun analyze(packet: ReasoningPacket): KairoAnswer =
                            error("Quick ask must not call cloud reasoning")
                    },
                ),
                continuity = ConversationContinuityService(store),
                conversation = ConversationCaptureSession("conversation-test"),
            )

            val answer = copilot.ask("Why did the breast images disappear from MagView?")

            assertEquals("I don't know from the available MANA evidence.", answer.text)
            assertEquals(
                listOf("conversation-test-turn-0", "conversation-test-turn-1"),
                store.all().map { it.id },
            )
            assertEquals(
                listOf(
                    "Why did the breast images disappear from MagView?",
                    answer.text,
                ),
                store.all().map { it.text },
            )
            assertEquals(
                setOf(EvidenceMemoryKind.CONVERSATION),
                store.all().map { it.kind }.toSet(),
            )
        }
}
