package kairo.android

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import kairo.android.auth.AuthenticationState
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import org.junit.Rule
import org.junit.Test

class ProtectedContentTest {

    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun protected_content_does_not_render_until_unlocked() {
        composeRule.setContent {
            KairoShell(
                connectivity =
                    ConnectivityCapability.Offline,
                authenticationState =
                    AuthenticationState.Locked,
            )
        }

        composeRule
            .onNodeWithText("Unlock Kairo")
            .assertIsDisplayed()

        composeRule
            .onAllNodesWithText("Systems")
            .assertCountEquals(0)

        composeRule
            .onAllNodesWithText("Workflows")
            .assertCountEquals(0)
    }
}
