package kairo.android.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RelockTimerTest {

    @Test
    fun relocks_after_background_timeout() {
        var now = 1_000L
        val timer =
            RelockTimer(
                timeoutMillis = 300_000L,
                nowMillis = { now },
            )

        timer.onLeaveForeground()
        now += 299_999L
        assertFalse(timer.onResume())

        timer.onLeaveForeground()
        now += 300_000L
        assertTrue(timer.onResume())
    }
}
