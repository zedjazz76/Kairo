package kairo.android.copilot

fun interface Copilot {
    suspend fun ask(
        question: String,
    ): String
}
