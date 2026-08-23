package kairo.android.app

import androidx.activity.compose.setContent
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import kairo.android.auth.AuthenticationState
import kairo.android.capture.KnowledgeCaptureRequest
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import kairo.android.test.TestFragmentActivity
import kairo.platform.db.RoomKnowledgeRepository
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test

class KairoActivitySourcesTest {

    @get:Rule
    val composeRule =
        createAndroidComposeRule<TestFragmentActivity>()

    @Test
    fun live_session_sources_render_in_shell() {
        val database =
            KairoDatabaseFactory.open(
                context = composeRule.activity,
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

        val sources =
            runBlocking {
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
                session.evidenceSources()
            }

        val expectedSourceId = sources.single().sourceId

        composeRule.activity.runOnUiThread {
            composeRule.activity.setContent {
                KairoShell(
                    connectivity = ConnectivityCapability.Offline,
                    authenticationState = AuthenticationState.Unlocked,
                    evidenceSources = sources,
                )
            }
        }

        composeRule
            .onNodeWithText("Sources")
            .performClick()

        composeRule
            .onNodeWithText("Evidence sources")
            .assertIsDisplayed()

        composeRule
            .onNodeWithText(expectedSourceId)
            .assertIsDisplayed()

        database.close()
    }
}
