package kairo.application

enum class SensitiveContentDecision {
    ALLOW,
    BLOCK_CLOUD_REASONING,
}

fun interface SensitiveContentGuard {
    fun decide(text: String): SensitiveContentDecision

    companion object {
        val ALLOW_ALL =
            SensitiveContentGuard {
                SensitiveContentDecision.ALLOW
            }
    }
}
