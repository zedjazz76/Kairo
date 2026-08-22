package kairo.android.navigation

import org.junit.Assert.assertEquals
import org.junit.Test

class KairoNavigatorTest {

    @Test
    fun navigator_moves_to_destination_and_back_home() {
        val navigator = KairoNavigator()

        navigator.navigateTo(
            KairoDestination.Systems,
        )

        assertEquals(
            KairoDestination.Systems,
            navigator.destination,
        )

        navigator.backHome()

        assertEquals(
            KairoDestination.Home,
            navigator.destination,
        )
    }
}
