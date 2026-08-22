package kairo.android.auth

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

enum class AuthenticationAvailability {
    Available,
    Unavailable,
}

class AndroidAuthenticator(
    private val activity: FragmentActivity,
) : Authenticator {

    private val biometricManager =
        BiometricManager.from(activity)

    fun availability(): AuthenticationAvailability {
        val result =
            biometricManager.canAuthenticate(
                BIOMETRIC_STRONG or DEVICE_CREDENTIAL,
            )

        return when (result) {
            BiometricManager.BIOMETRIC_SUCCESS ->
                AuthenticationAvailability.Available

            else ->
                AuthenticationAvailability.Unavailable
        }
    }

    override suspend fun authenticate(): Boolean =
        suspendCancellableCoroutine { continuation ->
            val executor =
                ContextCompat.getMainExecutor(activity)

            val prompt =
                BiometricPrompt(
                    activity,
                    executor,
                    object : BiometricPrompt.AuthenticationCallback() {

                        override fun onAuthenticationSucceeded(
                            result: BiometricPrompt.AuthenticationResult,
                        ) {
                            if (continuation.isActive) {
                                continuation.resume(true)
                            }
                        }

                        override fun onAuthenticationError(
                            errorCode: Int,
                            errString: CharSequence,
                        ) {
                            if (continuation.isActive) {
                                continuation.resume(false)
                            }
                        }

                        override fun onAuthenticationFailed() {
                            // A failed biometric scan may be retried by the
                            // system prompt, so do not complete the coroutine.
                        }
                    },
                )

            continuation.invokeOnCancellation {
                prompt.cancelAuthentication()
            }

            val promptInfo =
                BiometricPrompt.PromptInfo.Builder()
                    .setTitle("Unlock Kairo")
                    .setSubtitle(
                        "Authenticate to access protected Kairo content",
                    )
                    .setAllowedAuthenticators(
                        BIOMETRIC_STRONG or DEVICE_CREDENTIAL,
                    )
                    .build()

            prompt.authenticate(promptInfo)
        }
}
