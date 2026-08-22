package kairo.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import kairo.android.auth.AndroidAuthenticator
import kairo.android.auth.AuthenticationAvailability
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidAuthenticatorTest {

    @Test
    fun device_authenticator_reports_supported_or_unavailable_explicitly() {
        val authenticator =
            AndroidAuthenticator.forTestEnvironment()

        val availability =
            authenticator.availability()

        assertTrue(
            availability ==
                AuthenticationAvailability.Available ||
                availability ==
                    AuthenticationAvailability.Unavailable,
        )
    }
}
