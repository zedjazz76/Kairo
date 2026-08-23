package kairo.android.app

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import kairo.android.auth.Authenticator
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test

class KairoActivityDeepAnalyzeTest {

    @get:Rule
    val composeRule =
        createAndroidComposeRule<KairoActivity>()

    @Before
    fun configureAuthenticator() {
        KairoActivity.authenticatorOverride =
            object : Authenticator {
                override suspend fun authenticate(): Boolean = true
            }
    }

    @After
    fun clearAuthenticator() {
        KairoActivity.authenticatorOverride = null
    }

    @Test
    fun activity_wires_live_deep_analyze_session_into_shell() {
        composeRule
            .onNodeWithText("Unlock Kairo")
            .performClick()

        composeRule
            .onNodeWithText("Deep Analyze")
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
    }
}
