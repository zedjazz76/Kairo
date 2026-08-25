package kairo.android.app

import androidx.activity.compose.setContent
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import kairo.android.auth.AuthenticationState
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import kairo.android.test.TestFragmentActivity
import kairo.platform.db.RoomKnowledgeRepository
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test

class KairoActivityDeepAnalyzeTest {

    @get:Rule
    val composeRule =
        createAndroidComposeRule<TestFragmentActivity>()

    @Test
    fun activity_wires_live_deep_analyze_session_into_shell() {
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

        runBlocking {
            session.load()
        }

        composeRule.activity.runOnUiThread {
            composeRule.activity.setContent {
                KairoShell(
                    connectivity = ConnectivityCapability.Online,
                    authenticationState = AuthenticationState.Unlocked,
                    deepAnalyze = session::deepAnalyze,
                )
            }
        }

        composeRule
            .onNodeWithText("Analyze")
            .performClick()

        composeRule
            .onNodeWithText("Analyze question")
            .performTextInput("Why are studies not reaching MagView?")

        composeRule
            .onNodeWithText("Analyze")
            .performClick()

        composeRule
            .onNodeWithText("UNKNOWN_WORKFLOW_FAILURE")
            .assertIsDisplayed()

        database.close()
    }
}
