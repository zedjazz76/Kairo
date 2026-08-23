package kairo.android.app

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.time.Instant
import kairo.application.MemoryCandidateDraft
import kairo.domain.EvidenceRef
import kairo.domain.EvidenceState
import kairo.domain.FactObject
import kairo.domain.KnowledgeScope
import kairo.platform.db.CoreCommandV1
import kairo.platform.db.KairoDatabase
import kairo.platform.db.RoomKnowledgeRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PersistedKnowledgeCopilotTest {

    @Test
    fun copilot_answers_from_fact_persisted_in_room() =
        runBlocking {
            val context = ApplicationProvider.getApplicationContext<android.content.Context>()
            val database: KairoDatabase = KairoDatabaseFactory.open(context)
            database.clearAllTables()
            val repository = RoomKnowledgeRepository(database)

            repository.apply(
                CoreCommandV1.RecordMemoryCandidate(
                    candidate =
                        MemoryCandidateDraft(
                            subject = "modality-worklist",
                            predicate = "hosted-by",
                            objectValue = FactObject.Literal("Merge PACS hosts the modality worklist."),
                            scope = KnowledgeScope.MANA_PRODUCTION,
                            proposedState = EvidenceState.OBSERVED,
                            evidence = setOf(EvidenceRef("persisted-source")),
                        ),
                    recordedAt = Instant.parse("2026-08-22T00:00:00Z"),
                    correlationId = "test-persisted-knowledge-candidate",
                ),
            )

            val pending = repository.pendingMemoryCandidates().single()
            repository.apply(
                CoreCommandV1.ApproveMemoryCandidate(
                    candidateId = pending.id,
                    reviewer = "LOCAL_OWNER",
                    reviewedAt = Instant.parse("2026-08-22T00:00:01Z"),
                    correlationId = "test-persisted-knowledge",
                ),
            )

            val root = KairoCompositionRoot.fromRepository(repository = repository)
            val answer = root.copilot.ask("Who hosts the modality worklist?")

            assertEquals("Merge PACS hosts the modality worklist.", answer.text)
            database.close()
        }
}
