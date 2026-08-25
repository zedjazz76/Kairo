package kairo.platform.db

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import kairo.application.MemoryCandidateId
import kairo.application.MemoryDecision
import kairo.application.MemoryDecisionType
import kairo.application.PendingMemoryCandidate
import kairo.domain.AnchorLocator
import kairo.domain.CaptureSessionId
import kairo.domain.EvidenceState
import kairo.domain.KnowledgeScope
import kairo.domain.SourceAnchor
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.ingestion.MemoryCandidateDraft
import org.junit.After
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class RoomMemoryInboxStoreTest {

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
    fun `pending candidate and decision survive store recreation`() {
        val firstStore = RoomMemoryInboxStore(database)

        val candidate = PendingMemoryCandidate(
            id = MemoryCandidateId("candidate-1"),
            draft = MemoryCandidateDraft(
                sessionId = CaptureSessionId("session-1"),
                subjectLabel = "Merge PACS",
                text = "Merge PACS hosts DMWL.",
                evidenceAnchors = setOf(
                    SourceAnchor(
                        sourceId = SourceId("source-1"),
                        variantId = SourceVariantId("variant-1"),
                        locator = AnchorLocator.TextSpan(0, 22),
                    ),
                ),
                proposedScope = KnowledgeScope.PROJECT,
                proposedState = EvidenceState.PLANNED,
            ),
        )

        firstStore.savePending(candidate)

        firstStore.saveDecision(
            MemoryDecision(
                candidateId = candidate.id,
                type = MemoryDecisionType.DEFERRED,
                reviewer = "LOCAL_OWNER",
                decidedAt = Instant.parse("2026-08-22T13:00:00Z"),
            ),
        )

        val recreatedStore = RoomMemoryInboxStore(database)

        assertEquals(
            candidate.id,
            recreatedStore.pending().single().id,
        )
        assertEquals(
            KnowledgeScope.PROJECT,
            recreatedStore.pending().single().draft.proposedScope,
        )
        assertEquals(
            EvidenceState.PLANNED,
            recreatedStore.pending().single().draft.proposedState,
        )

        assertEquals(
            MemoryDecisionType.DEFERRED,
            recreatedStore.decisions().single().type,
        )

        recreatedStore.removePending(candidate.id)

        assertTrue(recreatedStore.pending().isEmpty())
    }
}
