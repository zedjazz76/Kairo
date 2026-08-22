package kairo.android.auth

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL

enum class AuthenticationAvailability {
    Available,
    Unavailable,
}

class AndroidAuthenticator(
    context: Context,
) {

    private val biometricManager =
        BiometricManager.from(context)

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
}
