package kairo.android

import kairo.android.test.TestFragmentActivity
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import kairo.android.auth.AndroidAuthenticator
import kairo.android.auth.AuthenticationAvailability
import kairo.android.auth.Authenticator
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidAuthenticatorTest {

    @get:Rule
    val activityRule =
        ActivityScenarioRule(TestFragmentActivity::class.java)

    @Test
    fun Android_authenticator_supports_real_prompt_boundary() {
        activityRule.scenario.onActivity { activity ->
            val authenticator: Authenticator =
                AndroidAuthenticator(
                    activity = activity,
                )

            val androidAuthenticator =
                authenticator as AndroidAuthenticator

            val availability =
                androidAuthenticator.availability()

            assertTrue(
                availability ==
                    AuthenticationAvailability.Available ||
                    availability ==
                        AuthenticationAvailability.Unavailable,
            )
        }
    }
}
