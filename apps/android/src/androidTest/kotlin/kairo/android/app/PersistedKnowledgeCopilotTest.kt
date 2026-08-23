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
class PersistedKnowledgeCopilotTest {

    @Test
    fun copilot_answers_from_fact_persisted_in_room() =
        runBlocking {
            val context =
                ApplicationProvider.getApplicationContext<android.content.Context>()
            val database = KairoDatabaseFactory.open(context)
            database.clearAllTables()
            val repository = RoomKnowledgeRepository(database)
            val session = KairoKnowledgeSession(repository)
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

            val root = KairoCompositionRoot.fromRepository(repository = repository)
            val answer = root.copilot.ask("Who hosts the modality worklist?")

            assertEquals("Merge PACS hosts the modality worklist.", answer.text)
            database.close()
        }
}
