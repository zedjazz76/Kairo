package kairo.android.app

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kairo.android.capture.KnowledgeCaptureRequest
import kairo.application.MemoryInboxService
import kairo.platform.db.RoomKnowledgeRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RoomKnowledgeCaptureTest {

    @Test
    fun save_creates_pending_memory_candidate_without_active_fact() =
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

            val memoryInbox =
                MemoryInboxService(
                    repository = repository,
                )

            val capture =
                RoomKnowledgeCapture(
                    repository = repository,
                    memoryInbox = memoryInbox,
                )

            capture.save(
                KnowledgeCaptureRequest(
                    subject = "modality-worklist",
                    predicate = "hosted-by",
                    value =
                        "Merge PACS hosts the modality worklist.",
                ),
            )

            assertEquals(
                1,
                memoryInbox.pending().size,
            )

            val root =
                KairoCompositionRoot.fromRepository(
                    repository = repository,
                )

            val answer =
                root.copilot.ask(
                    "Who hosts the modality worklist?",
                )

            assertEquals(
                "I don't know from the available MANA evidence.",
                answer,
            )

            database.close()
        }
}
