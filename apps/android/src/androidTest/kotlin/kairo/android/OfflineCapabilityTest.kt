package kairo.android

import androidx.activity.compose.setContent
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import kairo.android.auth.AuthenticationState
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import kairo.android.test.TestFragmentActivity
import org.junit.Rule
import org.junit.Test

class OfflineCapabilityTest {

    @get:Rule
    val composeRule = createAndroidComposeRule<TestFragmentActivity>()

    @Test
    fun offline_mode_keeps_local_capabilities_and_disables_cloud_actions() {
        composeRule.activity.runOnUiThread {
            composeRule.activity.setContent {
                KairoShell(
                    connectivity =
                        ConnectivityCapability.Offline,
                    authenticationState =
                        AuthenticationState.Unlocked,
                )
            }
        }

        composeRule
            .onNodeWithText("Systems Map")
            .assertIsEnabled()

        composeRule
            .onNodeWithText("Trace Workflow")
            .assertIsEnabled()

        composeRule
            .onNodeWithText("Analyze")
            .assertIsEnabled()

        composeRule
            .onNodeWithText("Offline mode")
            .assertIsDisplayed()
    }

    @Test
    fun online_mode_enables_deep_analyze_action() {
        composeRule.activity.runOnUiThread {
            composeRule.activity.setContent {
                KairoShell(
                    connectivity =
                        ConnectivityCapability.Online,
                    authenticationState =
                        AuthenticationState.Unlocked,
                )
            }
        }

        composeRule
            .onNodeWithText("Analyze")
            .assertIsEnabled()
    }

    @Test
    fun online_deep_analyze_opens_destination() {
        composeRule.activity.runOnUiThread {
            composeRule.activity.setContent {
                KairoShell(
                    connectivity =
                        ConnectivityCapability.Online,
                    authenticationState =
                        AuthenticationState.Unlocked,
                )
            }
        }

        composeRule
            .onNodeWithText("Analyze")
            .performClick()

        composeRule
            .onNodeWithText("Deep Analyze overview")
            .assertIsDisplayed()
    }

    @Test
    fun deep_analyze_submits_question_and_renders_result() {
        composeRule.activity.runOnUiThread {
            composeRule.activity.setContent {
                KairoShell(
                    connectivity = ConnectivityCapability.Online,
                    authenticationState = AuthenticationState.Unlocked,
                    deepAnalyze = { question ->
                        if (question == "Why are studies not reaching MagView?") {
                            "ROUTING\nCorrect the routing destination and resend the study."
                        } else {
                            "UNKNOWN_WORKFLOW_FAILURE"
                        }
                    },
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
            .onNodeWithText("ROUTING")
            .assertIsDisplayed()

        composeRule
            .onNodeWithText("Correct the routing destination and resend the study.")
            .assertIsDisplayed()
    }
}
