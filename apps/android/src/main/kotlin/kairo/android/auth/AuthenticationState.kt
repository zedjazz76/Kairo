package kairo.android.auth

sealed interface AuthenticationState {
    data object Locked : AuthenticationState
    data object Unlocked : AuthenticationState
}
