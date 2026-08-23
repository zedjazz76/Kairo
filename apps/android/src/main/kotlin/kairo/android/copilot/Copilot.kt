package kairo.android.copilot

import kairo.application.KairoAnswer

fun interface Copilot {
    suspend fun ask(
        question: String,
    ): KairoAnswer
}
