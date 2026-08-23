package kairo.android.copilot

import kairo.application.AskKairoService
import kairo.application.KairoAnswer

class AskKairoCopilot(
    private val service: AskKairoService,
) : Copilot {

    override suspend fun ask(
        question: String,
    ): KairoAnswer =
        service.quick(question)
}
