package kairo.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import kairo.android.auth.AuthenticationState
import kairo.android.copilot.Copilot
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import kairo.application.AnswerConfidence
import kairo.application.KairoAnswer
import org.junit.Rule
import org.junit.Test

class CopilotStructuredAnswerTest {

    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun copilot_renders_structured_answer_sections() {
        val copilot = object : Copilot {
            override suspend fun ask(question: String): KairoAnswer =
                KairoAnswer(
                    text = "Merge PACS hosts the modality worklist.",
                    assessment = "Current evidence supports Merge PACS as the active DMWL host.",
                    currentManaUnderstanding = "Merge PACS is the observed production DMWL host.",
                    nextAction = "Verify migration-specific worklist routing before cutover.",
                    confidence = AnswerConfidence.HIGH,
                )
        }

        composeRule.setContent {
            KairoShell(
                connectivity = ConnectivityCapability.Offline,
                authenticationState = AuthenticationState.Unlocked,
                copilot = copilot,
            )
        }

        composeRule.onNodeWithText("Ask Kairo").performClick()
        composeRule.onNodeWithText("Ask Kairo").performTextInput("Who hosts DMWL?")
        composeRule.onNodeWithText("Send").performClick()

        composeRule.onNodeWithText("Assessment").assertIsDisplayed()
        composeRule.onNodeWithText("Current MANA Understanding").assertIsDisplayed()
        composeRule.onNodeWithText("Next action").assertIsDisplayed()
        composeRule.onNodeWithText("Confidence").assertIsDisplayed()
        composeRule.onNodeWithText("HIGH").assertIsDisplayed()
    }
}
