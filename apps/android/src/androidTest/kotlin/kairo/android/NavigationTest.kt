package kairo.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import kairo.android.auth.AuthenticationState
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import org.junit.Rule
import org.junit.Test

class NavigationTest {

    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun tapping_systems_opens_systems_destination() {
        composeRule.setContent {
            KairoShell(
                connectivity =
                    ConnectivityCapability.Offline,
                authenticationState =
                    AuthenticationState.Unlocked,
            )
        }

        composeRule
            .onNodeWithText("Systems")
            .performClick()

        composeRule
            .onNodeWithText("Systems overview")
            .assertIsDisplayed()
    }
    @Test
    fun systems_destination_can_return_home() {
        composeRule.setContent {
            KairoShell(
                connectivity =
                    ConnectivityCapability.Offline,
                authenticationState =
                    AuthenticationState.Unlocked,
            )
        }

        composeRule
            .onNodeWithText("Systems")
            .performClick()

        composeRule
            .onNodeWithText("Back")
            .performClick()

        composeRule
            .onNodeWithText("Systems")
            .assertIsDisplayed()

        composeRule
            .onNodeWithText("Workflows")
            .assertIsDisplayed()
    }


    @Test
    fun workflows_destination_opens_and_returns_home() {
        composeRule.setContent {
            KairoShell(
                connectivity =
                    ConnectivityCapability.Offline,
                authenticationState =
                    AuthenticationState.Unlocked,
            )
        }

        composeRule
            .onNodeWithText("Workflows")
            .performClick()

        composeRule
            .onNodeWithText("Workflows overview")
            .assertIsDisplayed()

        composeRule
            .onNodeWithText("Back")
            .performClick()

        composeRule
            .onNodeWithText("Systems")
            .assertIsDisplayed()

        composeRule
            .onNodeWithText("Workflows")
            .assertIsDisplayed()
    }


    @Test
    fun projects_destination_opens_and_returns_home() {
        composeRule.setContent {
            KairoShell(
                connectivity =
                    ConnectivityCapability.Offline,
                authenticationState =
                    AuthenticationState.Unlocked,
            )
        }

        composeRule
            .onNodeWithText("Projects")
            .performClick()

        composeRule
            .onNodeWithText("Projects overview")
            .assertIsDisplayed()

        composeRule
            .onNodeWithText("Back")
            .performClick()

        composeRule
            .onNodeWithText("Projects")
            .assertIsDisplayed()
    }


    @Test
    fun knowledge_destination_opens_and_returns_home() {
        composeRule.setContent {
            KairoShell(
                connectivity =
                    ConnectivityCapability.Offline,
                authenticationState =
                    AuthenticationState.Unlocked,
            )
        }

        composeRule
            .onNodeWithText("Knowledge")
            .performClick()

        composeRule
            .onNodeWithText("Knowledge overview")
            .assertIsDisplayed()

        composeRule
            .onNodeWithText("Back")
            .performClick()

        composeRule
            .onNodeWithText("Knowledge")
            .assertIsDisplayed()
    }


    @Test
    fun capture_destination_opens_and_returns_home() {
        composeRule.setContent {
            KairoShell(
                connectivity =
                    ConnectivityCapability.Offline,
                authenticationState =
                    AuthenticationState.Unlocked,
            )
        }

        composeRule
            .onNodeWithText("Capture")
            .performClick()

        composeRule
            .onNodeWithText("Capture intake")
            .assertIsDisplayed()

        composeRule
            .onNodeWithText("Back")
            .performClick()

        composeRule
            .onNodeWithText("Capture")
            .assertIsDisplayed()
    }


    @Test
    fun sources_destination_opens_and_returns_home() {
        composeRule.setContent {
            KairoShell(
                connectivity =
                    ConnectivityCapability.Offline,
                authenticationState =
                    AuthenticationState.Unlocked,
            )
        }

        composeRule
            .onNodeWithText("Sources")
            .performClick()

        composeRule
            .onNodeWithText("Sources overview")
            .assertIsDisplayed()

        composeRule
            .onNodeWithText("Back")
            .performClick()

        composeRule
            .onNodeWithText("Sources")
            .assertIsDisplayed()
    }


    @Test
    fun memory_inbox_destination_opens_and_returns_home() {
        composeRule.setContent {
            KairoShell(
                connectivity =
                    ConnectivityCapability.Offline,
                authenticationState =
                    AuthenticationState.Unlocked,
            )
        }

        composeRule
            .onNodeWithText("Memory Inbox")
            .performClick()

        composeRule
            .onNodeWithText("Memory Inbox overview")
            .assertIsDisplayed()

        composeRule
            .onNodeWithText("Back")
            .performClick()

        composeRule
            .onNodeWithText("Memory Inbox")
            .assertIsDisplayed()
    }


    @Test
    fun copilot_destination_opens_and_returns_home() {
        composeRule.setContent {
            KairoShell(
                connectivity =
                    ConnectivityCapability.Offline,
                authenticationState =
                    AuthenticationState.Unlocked,
            )
        }

        composeRule
            .onNodeWithText("Copilot")
            .performClick()

        composeRule
            .onNodeWithText("Kairo Copilot")
            .assertIsDisplayed()

        composeRule
            .onNodeWithText("Back")
            .performClick()

        composeRule
            .onNodeWithText("Copilot")
            .assertIsDisplayed()
    }


}
