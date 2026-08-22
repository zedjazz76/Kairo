package kairo.android.copilot

import org.junit.Test

class AskKairoCopilotTest {

    @Test
    fun adapter_is_wired_to_core_application_module() {
        Class.forName(
            "kairo.application.AskKairoService",
        )
    }
}
