package kairo.android

import androidx.activity.compose.setContent
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import kairo.android.auth.AuthenticationState
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import kairo.android.test.TestFragmentActivity
import org.junit.Rule
import org.junit.Test

class SourcesEvidenceTest {

    @get:Rule
    val composeRule =
        createAndroidComposeRule<TestFragmentActivity>()

    @Test
    fun sources_destination_renders_current_evidence_references() {
        composeRule.activity.runOnUiThread {
            composeRule.activity.setContent {
                KairoShell(
                    connectivity = ConnectivityCapability.Offline,
                    authenticationState = AuthenticationState.Unlocked,
                    evidenceSources = listOf(
                        "source-dmwl — Merge PACS admin manual",
                        "source-workflow — MANA workflow observation",
                    ),
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
            .onNodeWithText("source-dmwl — Merge PACS admin manual")
            .assertIsDisplayed()

        composeRule
            .onNodeWithText("source-workflow — MANA workflow observation")
            .assertIsDisplayed()
    }
}
