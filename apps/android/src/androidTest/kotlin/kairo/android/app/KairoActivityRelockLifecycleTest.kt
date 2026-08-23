package kairo.android.app

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.lifecycle.Lifecycle
import kairo.android.auth.Authenticator
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test

class KairoActivityRelockLifecycleTest {

    @get:Rule
    val composeRule = createAndroidComposeRule<KairoActivity>()

    @Before
    fun setUp() {
        KairoActivity.authenticatorOverride = Authenticator { true }
        KairoActivity.relockTimeoutMillisOverride = 1L
    }

    @After
    fun tearDown() {
        KairoActivity.authenticatorOverride = null
        KairoActivity.relockTimeoutMillisOverride = null
    }

    @Test
    fun activity_relocks_after_background_timeout() {
        composeRule.onNodeWithText("Unlock Kairo").performClick()
        composeRule.onNodeWithText("Systems").assertIsDisplayed()

        composeRule.activityRule.scenario.moveToState(Lifecycle.State.CREATED)
        Thread.sleep(5)
        composeRule.activityRule.scenario.moveToState(Lifecycle.State.RESUMED)

        composeRule.onNodeWithText("Unlock Kairo").assertIsDisplayed()
    }
}
