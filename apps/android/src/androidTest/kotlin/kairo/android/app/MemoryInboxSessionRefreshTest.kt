package kairo.android.app

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kairo.android.capture.KnowledgeCaptureRequest
import kairo.platform.db.RoomKnowledgeRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MemoryInboxSessionRefreshTest {

    @Test
    fun approving_pending_memory_refreshes_copilot_without_restart() =
        runBlocking {
            val context =
                ApplicationProvider.getApplicationContext<
                    android.content.Context
                >()

            val database =
                KairoDatabaseFactory.open(
                    context = context,
                )

            database.clearAllTables()

            val repository =
                RoomKnowledgeRepository(
                    database = database,
                )

            val session =
                KairoKnowledgeSession(
                    repository = repository,
                )

            session.load()

            session.knowledgeCapture.save(
                KnowledgeCaptureRequest(
                    subject = "modality-worklist",
                    predicate = "hosted-by",
                    value =
                        "Merge PACS hosts the modality worklist.",
                ),
            )

            assertEquals(
                "I don't know from the available MANA evidence.",
                session.copilot.ask(
                    "Who hosts the modality worklist?",
                ),
            )

            val pending =
                session.memoryInbox
                    .pending()
                    .single()

            session.approveMemory(
                candidateId = pending.id,
                reviewer = "LOCAL_OWNER",
            )

            assertEquals(
                "Merge PACS hosts the modality worklist.",
                session.copilot.ask(
                    "Who hosts the modality worklist?",
                ),
            )

            database.close()
        }

    @Test
    fun approved_simple_capture_is_immediately_queryable_by_subject() =
        runBlocking {
            val context =
                ApplicationProvider.getApplicationContext<
                    android.content.Context
                >()

            val database =
                KairoDatabaseFactory.open(
                    context = context,
                )

            database.clearAllTables()

            val repository =
                RoomKnowledgeRepository(
                    database = database,
                )

            val session =
                KairoKnowledgeSession(
                    repository = repository,
                )

            session.load()

            session.knowledgeCapture.save(
                KnowledgeCaptureRequest(
                    subject = "test",
                    predicate = "states",
                    value = "Test fact",
                ),
            )

            val pending =
                session.memoryInbox
                    .pending()
                    .single()

            session.approveMemory(
                candidateId = pending.id,
                reviewer = "LOCAL_OWNER",
            )

            assertEquals(
                "Test fact",
                session.copilot.ask("test"),
            )

            database.close()
        }

    @Test
    fun session_exposes_real_deep_analyze_capability() =
        runBlocking {
            val context =
                ApplicationProvider.getApplicationContext<
                    android.content.Context
                >()

            val database =
                KairoDatabaseFactory.open(
                    context = context,
                )

            database.clearAllTables()

            val repository =
                RoomKnowledgeRepository(
                    database = database,
                )

            val session =
                KairoKnowledgeSession(
                    repository = repository,
                )

            session.load()

            assertEquals(
                "UNKNOWN_WORKFLOW_FAILURE\nValidate the first unresolved workflow hop.",
                session.deepAnalyze(
                    "Why is this workflow failing?",
                ),
            )

            database.close()
        }

    @Test
    fun approved_capture_exposes_evidence_sources_for_sources_screen() =
        runBlocking {
            val context =
                ApplicationProvider.getApplicationContext<
                    android.content.Context
                >()

            val database =
                KairoDatabaseFactory.open(
                    context = context,
                )

            database.clearAllTables()

            val repository =
                RoomKnowledgeRepository(
                    database = database,
                )

            val session =
                KairoKnowledgeSession(
                    repository = repository,
                )

            session.load()

            session.knowledgeCapture.save(
                KnowledgeCaptureRequest(
                    subject = "modality-worklist",
                    predicate = "hosted-by",
                    value = "Merge PACS hosts the modality worklist.",
                ),
            )

            val pending = session.memoryInbox.pending().single()

            session.approveMemory(
                candidateId = pending.id,
                reviewer = "LOCAL_OWNER",
            )

            val sources = session.evidenceSources()

            assertEquals(1, sources.size)
            assertEquals("manual-capture", sources.single().sourceId)

            database.close()
        }
}
