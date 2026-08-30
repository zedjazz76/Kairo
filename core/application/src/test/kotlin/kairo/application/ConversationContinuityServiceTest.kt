package kairo.application

import java.time.Instant
import kairo.domain.KnowledgeScope
import kairo.retrieval.EvidenceMemoryKind
import kairo.retrieval.EvidenceMemoryRecord
import kairo.retrieval.RetrievalQuery
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals

class ConversationContinuityServiceTest {

    @Test
    fun `chat and upload evidence remain searchable after service recreation`() = runTest {
        val store = InMemoryEvidenceMemoryStore()
        val firstSession = ConversationContinuityService(store)

        firstSession.rememberConversationTurn(
            conversationId = "conversation-1",
            turnNumber = 3,
            text = "MagView delivery stopped because the PACS routing destination was wrong.",
            capturedAt = Instant.parse("2026-08-29T14:00:00Z"),
        )
        firstSession.rememberUploadExcerpt(
            sourceId = "upload-1",
            excerptId = "page-2",
            text = "The breast workflow confirms PACS forwards studies to MagView for interpretation.",
            capturedAt = Instant.parse("2026-08-29T14:05:00Z"),
        )

        val reopenedSession = ConversationContinuityService(store)
        val result = reopenedSession.retrieve(
            RetrievalQuery(
                text = "What did we learn when breast images disappeared from the viewer?",
                scope = KnowledgeScope.MANA_PRODUCTION,
            ),
            facts = emptyList(),
        )

        assertEquals(emptyList(), result.rankedClaims)
        assertEquals(
            setOf(EvidenceMemoryKind.CONVERSATION, EvidenceMemoryKind.UPLOAD),
            result.sources.mapNotNull { it.kind }.toSet(),
        )
    }
}
