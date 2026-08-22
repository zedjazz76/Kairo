package kairo.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import kairo.android.auth.Authenticator
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import org.junit.Rule
import org.junit.Test

class AuthenticationFlowTest {

    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun successful_authentication_unlocks_protected_content() {
        val authenticator =
            object : Authenticator {
                override suspend fun authenticate(): Boolean =
                    true
            }

        composeRule.setContent {
            KairoShell(
                connectivity =
                    ConnectivityCapability.Offline,
                authenticator = authenticator,
            )
        }

        composeRule
            .onNodeWithText("Unlock Kairo")
            .assertIsDisplayed()
            .performClick()

        composeRule.waitForIdle()

        composeRule
            .onNodeWithText("Systems")
            .assertIsDisplayed()

        composeRule
            .onNodeWithText("Workflows")
            .assertIsDisplayed()
    }
}
