package kairo.android

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import kairo.android.auth.AuthenticationState
import kairo.android.capture.KnowledgeCapture
import kairo.android.capture.KnowledgeCaptureRequest
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import kotlinx.coroutines.delay
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class CaptureKnowledgeTest {

    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun capture_submits_structured_fact() {
        var captured: KnowledgeCaptureRequest? = null

        val knowledgeCapture =
            object : KnowledgeCapture {
                override suspend fun save(
                    request: KnowledgeCaptureRequest,
                ) {
                    captured = request
                }
            }

        composeRule.setContent {
            KairoShell(
                connectivity =
                    ConnectivityCapability.Offline,
                authenticationState =
                    AuthenticationState.Unlocked,
                knowledgeCapture = knowledgeCapture,
            )
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

        composeRule.waitForIdle()

        assertEquals(
            KnowledgeCaptureRequest(
                subject = "modality-worklist",
                predicate = "hosted-by",
                value =
                    "Merge PACS hosts the modality worklist.",
            ),
            captured,
        )
    }

    @Test
    fun save_is_disabled_while_capture_is_incomplete() {
        val knowledgeCapture =
            KnowledgeCapture {
            }

        composeRule.setContent {
            KairoShell(
                connectivity =
                    ConnectivityCapability.Offline,
                authenticationState =
                    AuthenticationState.Unlocked,
                knowledgeCapture = knowledgeCapture,
            )
        }

        composeRule
            .onNodeWithText("Capture")
            .performClick()

        val save =
            composeRule
                .onNodeWithText("Save")
                .fetchSemanticsNode()

        check(
            save.config.contains(
                SemanticsProperties.Disabled,
            ),
        )
    }

    @Test
    fun successful_save_shows_saved_confirmation() {
        val knowledgeCapture =
            KnowledgeCapture {
                delay(50)
            }

        composeRule.setContent {
            KairoShell(
                connectivity =
                    ConnectivityCapability.Offline,
                authenticationState =
                    AuthenticationState.Unlocked,
                knowledgeCapture = knowledgeCapture,
            )
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

        composeRule.waitUntil(
            timeoutMillis = 5_000,
        ) {
            composeRule
                .onAllNodesWithText("Saved")
                .fetchSemanticsNodes()
                .isNotEmpty()
        }

        composeRule
            .onNodeWithText("Saved")
            .assertIsDisplayed()
    }
}
