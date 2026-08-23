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
class CaptureRefreshTest {

    @Test
    fun capture_refreshes_copilot_without_restart() =
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

            val before =
                session.copilot.ask(
                    "Who hosts the modality worklist?",
                )

            assertEquals(
                "I don't know from the available MANA evidence.",
                before,
            )

            session.knowledgeCapture.save(
                KnowledgeCaptureRequest(
                    subject = "modality-worklist",
                    predicate = "hosted-by",
                    value =
                        "Merge PACS hosts the modality worklist.",
                ),
            )

            val after =
                session.copilot.ask(
                    "Who hosts the modality worklist?",
                )

            assertEquals(
                "Merge PACS hosts the modality worklist.",
                after,
            )

            database.close()
        }
}
