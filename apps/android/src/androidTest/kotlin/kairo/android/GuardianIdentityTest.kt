package kairo.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import kairo.android.auth.AuthenticationState
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import kairo.android.test.TestFragmentActivity
import org.junit.Rule
import org.junit.Test

class GuardianIdentityTest {

    @get:Rule
    val composeRule = createAndroidComposeRule<TestFragmentActivity>()

    @Test
    fun unlocked_home_exposes_the_guardian_wordmark() {
        composeRule.setContent {
            KairoShell(
                connectivity = ConnectivityCapability.Offline,
                authenticationState = AuthenticationState.Unlocked,
            )
        }

        composeRule
            .onNodeWithContentDescription("Kairo Guardian wordmark")
            .assertIsDisplayed()
    }
}
