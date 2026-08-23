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
class RoomKnowledgeCaptureTest {

    @Test
    fun save_persists_retrievable_confirmed_fact() =
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

            val capture =
                RoomKnowledgeCapture(
                    repository = repository,
                )

            capture.save(
                KnowledgeCaptureRequest(
                    subject = "modality-worklist",
                    predicate = "hosted-by",
                    value =
                        "Merge PACS hosts the modality worklist.",
                ),
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
                "Merge PACS hosts the modality worklist.",
                answer,
            )

            database.close()
        }
}
