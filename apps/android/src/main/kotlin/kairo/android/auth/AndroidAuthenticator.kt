package kairo.android.auth

enum class AuthenticationAvailability {
    Available,
    Unavailable,
}

class AndroidAuthenticator private constructor(
    private val availabilityProvider: () -> AuthenticationAvailability,
) {

    fun availability(): AuthenticationAvailability =
        availabilityProvider()

    companion object {
        fun forTestEnvironment(): AndroidAuthenticator =
            AndroidAuthenticator {
                AuthenticationAvailability.Available
            }
    }
}
