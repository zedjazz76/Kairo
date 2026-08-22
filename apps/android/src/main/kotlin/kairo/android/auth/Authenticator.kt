package kairo.android.auth

fun interface Authenticator {
    suspend fun authenticate(): Boolean
}
