package kairo.android

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kairo.android.auth.AndroidAuthenticator
import kairo.android.auth.AuthenticationAvailability
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidAuthenticatorTest {

    @Test
    fun device_authenticator_reports_real_device_capability() {
        val context =
            ApplicationProvider.getApplicationContext<android.content.Context>()

        val authenticator =
            AndroidAuthenticator(
                context = context,
            )

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
