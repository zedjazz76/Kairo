package kairo.android.copilot

import kairo.application.AskKairoService

class AskKairoCopilot(
    private val service: AskKairoService,
) : Copilot {

    override suspend fun ask(
        question: String,
    ): String =
        service.quick(question).text
}
