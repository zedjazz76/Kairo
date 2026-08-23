package kairo.android

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import kairo.android.auth.AuthenticationState
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import org.junit.Rule
import org.junit.Test

class AppRelockTimeoutTest {

    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun protected_content_relocks_after_background_timeout() {
        var timedOut = false

        composeRule.setContent {
            KairoShell(
                connectivity = ConnectivityCapability.Offline,
                authenticationState = AuthenticationState.Unlocked,
                shouldRelock = { timedOut },
            )
        }

        composeRule.onNodeWithText("Systems").assertIsDisplayed()

        timedOut = true
        composeRule.runOnIdle { }

        composeRule.onAllNodesWithText("Systems").assertCountEquals(0)
        composeRule.onNodeWithText("Unlock Kairo").assertIsDisplayed()
    }
}
