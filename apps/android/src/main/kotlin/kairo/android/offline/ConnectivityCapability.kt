package kairo.android.offline

sealed interface ConnectivityCapability {
    data object Online : ConnectivityCapability
    data object Offline : ConnectivityCapability
}
