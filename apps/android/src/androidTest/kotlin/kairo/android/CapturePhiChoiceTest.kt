package kairo.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import kairo.android.auth.AuthenticationState
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import kairo.security.UserSensitiveChoice
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class CapturePhiChoiceTest {

    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun likely_phi_capture_requires_sensitive_content_choice() {
        var selectedChoice: UserSensitiveChoice? = null

        composeRule.setContent {
            KairoShell(
                connectivity = ConnectivityCapability.Offline,
                authenticationState = AuthenticationState.Unlocked,
                captureContainsLikelyPhi = true,
                onSensitiveContentChoice = { selectedChoice = it },
            )
        }

        composeRule.onNodeWithText("Capture").performClick()

        composeRule.onNodeWithText("Potential PHI detected").assertIsDisplayed()
        composeRule.onNodeWithText("Redact and continue").assertIsDisplayed()
        composeRule.onNodeWithText("Temporary use only").assertIsDisplayed()
        composeRule.onNodeWithText("Cancel capture").assertIsDisplayed()

        composeRule.onNodeWithText("Temporary use only").performClick()
        assertEquals(UserSensitiveChoice.TEMPORARY_USE, selectedChoice)
    }
}
