package kairo.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import kairo.android.auth.AuthenticationState
import kairo.android.auth.Authenticator
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import org.junit.Rule
import org.junit.Test

class AppUnlockGateTest {

    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun protected_content_remains_hidden_until_authentication_succeeds() {
        val authenticator = Authenticator { true }

        composeRule.setContent {
            KairoShell(
                connectivity = ConnectivityCapability.Offline,
                authenticationState = AuthenticationState.Locked,
                authenticator = authenticator,
            )
        }

        composeRule.onNodeWithText("Unlock Kairo").assertIsDisplayed()
        composeRule.onAllNodesWithText("Systems").assertCountEquals(0)

        composeRule.onNodeWithText("Unlock Kairo").performClick()

        composeRule.onNodeWithText("Systems").assertIsDisplayed()
    }
}
