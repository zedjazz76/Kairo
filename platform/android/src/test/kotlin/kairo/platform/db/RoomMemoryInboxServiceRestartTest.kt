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

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class RoomMemoryInboxServiceRestartTest {

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
    fun `pending and deferred decision survive service recreation`() {
        val repository = NoOpKnowledgeRepository()

        val firstService = MemoryInboxService(
            repository = repository,
            store = RoomMemoryInboxStore(database),
        )

        val pending = firstService.receive(
            MemoryCandidateDraft(
                sessionId = CaptureSessionId("session-restart-room"),
                subjectLabel = "Merge PACS",
                text = "Merge PACS hosts DMWL.",
                evidenceAnchors = setOf(
                    SourceAnchor(
                        sourceId = SourceId("source-room"),
                        variantId = SourceVariantId("variant-room"),
                        locator = AnchorLocator.TextSpan(0, 22),
                    ),
                ),
            ),
        )

        firstService.defer(
            candidateId = pending.id,
            reviewer = "LOCAL_OWNER",
        )

        val recreatedService = MemoryInboxService(
            repository = repository,
            store = RoomMemoryInboxStore(database),
        )

        assertEquals(
            pending.id,
            recreatedService.pending().single().id,
        )

        val decision = recreatedService.decisions().single()

        assertEquals(
            MemoryDecisionType.DEFERRED,
            decision.type,
        )

        assertEquals(
            "LOCAL_OWNER",
            decision.reviewer,
        )

        assertEquals(
            pending.draft.evidenceAnchors,
            recreatedService.pending().single().draft.evidenceAnchors,
        )
    }

    private class NoOpKnowledgeRepository : KnowledgeRepository {

        override suspend fun appendFactVersion(
            fact: FactVersion,
            audit: AuditEvent,
        ) = Unit

        override suspend fun currentUnderstanding(
            query: FactQuery,
        ): List<FactVersion> =
            emptyList()

        override suspend fun history(
            lineageId: FactLineageId,
        ): List<FactVersion> =
            emptyList()

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
