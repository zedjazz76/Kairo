package kairo.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import kairo.android.app.KairoActivity
import org.junit.Rule
import org.junit.Test

class KairoActivityTest {

    @get:Rule
    val composeRule =
        createAndroidComposeRule<KairoActivity>()

    @Test
    fun app_launches_locked_before_any_protected_content_renders() {
        composeRule
            .onNodeWithText("Unlock Kairo")
            .assertIsDisplayed()

        composeRule
            .onNodeWithText("Systems")
            .assertDoesNotExist()
    }
}
