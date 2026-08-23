package kairo.android.app

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import kairo.android.auth.Authenticator
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test

class KairoActivityEndToEndMemoryFlowTest {

    @get:Rule
    val composeRule =
        createAndroidComposeRule<KairoActivity>()

    @Before
    fun configureAuthenticator() {
        KairoActivity.authenticatorOverride =
            Authenticator { true }
    }

    @After
    fun clearAuthenticator() {
        KairoActivity.authenticatorOverride = null
    }

    @Test
    fun capture_approve_and_ask_returns_approved_fact() {
        composeRule
            .onNodeWithText("Unlock Kairo")
            .performClick()

        composeRule.waitUntil(timeoutMillis = 10_000) {
            composeRule
                .onAllNodesWithText("Capture")
                .fetchSemanticsNodes()
                .isNotEmpty()
        }

        composeRule
            .onNodeWithText("Capture")
            .performClick()

        composeRule
            .onNodeWithText("Subject")
            .performTextInput("modality-worklist")

        composeRule
            .onNodeWithText("Predicate")
            .performTextInput("hosted-by")

        composeRule
            .onNodeWithText("Fact")
            .performTextInput(
                "Merge PACS hosts the modality worklist.",
            )

        composeRule
            .onNodeWithText("Save")
            .performClick()

        composeRule
            .onNodeWithText("Back")
            .performClick()

        composeRule
            .onNodeWithText("Memory Inbox")
            .performClick()

        composeRule
            .onNodeWithText(
                "Merge PACS hosts the modality worklist.",
            )
            .assertExists()

        composeRule
            .onNodeWithText("Approve")
            .performClick()

        composeRule
            .onNodeWithText("Back")
            .performClick()

        composeRule
            .onNodeWithText("Copilot")
            .performClick()

        composeRule
            .onNodeWithText("Ask Kairo")
            .performTextInput(
                "Who hosts the modality worklist?",
            )

        composeRule
            .onNodeWithText("Send")
            .performClick()

        composeRule.waitUntil(timeoutMillis = 5_000) {
            composeRule
                .onAllNodesWithText(
                    "Merge PACS hosts the modality worklist.",
                )
                .fetchSemanticsNodes()
                .isNotEmpty()
        }
    }
}
