package kairo.platform.db

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import kairo.application.AuditEvent
import kairo.application.FactQuery
import kairo.application.KnowledgeRepository
import kairo.application.MemoryDecisionType
import kairo.application.MemoryInboxService
import kairo.domain.AnchorLocator
import kairo.domain.CaptureSession
import kairo.domain.CaptureSessionId
import kairo.domain.FactLineageId
import kairo.domain.FactVersion
import kairo.domain.Source
import kairo.domain.SourceAnchor
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.ingestion.MemoryCandidateDraft
import org.junit.After
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class RoomMemoryInboxDecisionRestartTest {

    private val context =
        ApplicationProvider.getApplicationContext<Context>()

    private val database = Room.inMemoryDatabaseBuilder(
        context,
        KairoDatabase::class.java,
    )
        .allowMainThreadQueries()
        .build()

    @After
    fun close() {
        database.close()
    }

    @Test
    fun `rejected decision survives service recreation after candidate removal`() {
        val repository = NoOpKnowledgeRepository()

        val firstService = MemoryInboxService(
            repository = repository,
            store = RoomMemoryInboxStore(database),
        )

        val pending = firstService.receive(
            MemoryCandidateDraft(
                sessionId = CaptureSessionId("session-reject-restart"),
                subjectLabel = "Merge PACS",
                text = "Merge PACS hosts DMWL.",
                evidenceAnchors = setOf(
                    SourceAnchor(
                        sourceId = SourceId("source-reject-restart"),
                        variantId = SourceVariantId("variant-reject-restart"),
                        locator = AnchorLocator.TextSpan(0, 22),
                    ),
                ),
            ),
        )

        firstService.reject(
            candidateId = pending.id,
            reviewer = "LOCAL_OWNER",
        )

        val recreatedService = MemoryInboxService(
            repository = repository,
            store = RoomMemoryInboxStore(database),
        )

        assertTrue(recreatedService.pending().isEmpty())

        val decision = recreatedService.decisions().single()

        assertEquals(
            MemoryDecisionType.REJECTED,
            decision.type,
        )

        assertEquals(
            pending.id,
            decision.candidateId,
        )

        assertEquals(
            "LOCAL_OWNER",
            decision.reviewer,
        )
    }

    private class NoOpKnowledgeRepository : KnowledgeRepository {
        override suspend fun appendFactVersion(
            fact: FactVersion,
            audit: AuditEvent,
        ) = Unit

        override suspend fun currentUnderstanding(
            query: FactQuery,
        ): List<FactVersion> = emptyList()

        override suspend fun history(
            lineageId: FactLineageId,
        ): List<FactVersion> = emptyList()

        override suspend fun saveSource(
            source: Source,
            audit: AuditEvent,
        ) = Unit

        override suspend fun saveCaptureSession(
            session: CaptureSession,
            audit: AuditEvent,
        ) = Unit
    }
}
