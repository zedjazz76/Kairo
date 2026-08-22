package kairo.android.navigation

enum class KairoDestination {
    Home,
    Systems,
    Workflows,
    Projects,
    Knowledge,
    Capture,
    Sources,
    MemoryInbox,
    Copilot,
}

class KairoNavigator(
    initialDestination: KairoDestination =
        KairoDestination.Home,
) {
    var destination: KairoDestination =
        initialDestination
        private set

    fun navigateTo(
        destination: KairoDestination,
    ) {
        this.destination = destination
    }

    fun backHome() {
        destination = KairoDestination.Home
    }
}
