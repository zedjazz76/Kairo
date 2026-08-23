package kairo.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodes
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import kairo.android.auth.AuthenticationState
import kairo.android.copilot.Copilot
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import kairo.application.KairoAnswer
import org.junit.Rule
import org.junit.Test

class CopilotTest {

    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun copilot_submits_question_and_renders_quick_answer() {
        val copilot =
            object : Copilot {
                override suspend fun ask(
                    question: String,
                ): KairoAnswer =
                    KairoAnswer(
                        text = "Merge PACS hosts the modality worklist.",
                    )
            }

        composeRule.setContent {
            KairoShell(
                connectivity = ConnectivityCapability.Online,
                authenticationState = AuthenticationState.Unlocked,
                copilot = copilot,
            )
        }

        composeRule.onNodeWithText("Copilot").performClick()
        composeRule.onAllNodes(hasSetTextAction())[0]
            .performTextInput("Who hosts the modality worklist?")
        composeRule.onNodeWithText("Send").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithText("Merge PACS hosts the modality worklist.").assertIsDisplayed()
    }
}
