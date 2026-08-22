package kairo.application

import java.time.Instant
import kairo.domain.AnchorLocator
import kairo.domain.CaptureSessionId
import kairo.domain.SourceAnchor
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.ingestion.MemoryCandidateDraft
import kotlin.test.Test
import kotlin.test.assertEquals

class MemoryInboxStoreTest {

    @Test
    fun `pending candidate survives service recreation`() {
        val store = InMemoryMemoryInboxStore()

        val firstService = MemoryInboxService(
            repository = NoOpKnowledgeRepository(),
            store = store,
        )

        val received = firstService.receive(
            MemoryCandidateDraft(
                sessionId = CaptureSessionId("session-restart"),
                subjectLabel = "Merge PACS",
                text = "Merge PACS hosts DMWL.",
                evidenceAnchors = setOf(
                    SourceAnchor(
                        sourceId = SourceId("source-restart"),
                        variantId = SourceVariantId("variant-restart"),
                        locator = AnchorLocator.TextSpan(0, 22),
                    ),
                ),
            ),
        )

        val recreatedService = MemoryInboxService(
            repository = NoOpKnowledgeRepository(),
            store = store,
        )

        assertEquals(
            received.id,
            recreatedService.pending().single().id,
        )
    }

    private class NoOpKnowledgeRepository : KnowledgeRepository {
        override suspend fun appendFactVersion(
            fact: kairo.domain.FactVersion,
            audit: AuditEvent,
        ) = Unit

        override suspend fun currentUnderstanding(
            query: FactQuery,
        ): List<kairo.domain.FactVersion> = emptyList()

        override suspend fun history(
            lineageId: kairo.domain.FactLineageId,
        ): List<kairo.domain.FactVersion> = emptyList()

        override suspend fun saveSource(
            source: kairo.domain.Source,
            audit: AuditEvent,
        ) = Unit

        override suspend fun saveCaptureSession(
            session: kairo.domain.CaptureSession,
            audit: AuditEvent,
        ) = Unit
    }
}
