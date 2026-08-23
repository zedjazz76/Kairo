package kairo.android.app

class RelockTimer(
    private val timeoutMillis: Long,
    private val nowMillis: () -> Long,
) {
    private var backgroundedAtMillis: Long? = null

    fun onLeaveForeground() {
        backgroundedAtMillis = nowMillis()
    }

    fun onResume(): Boolean {
        val backgroundedAt = backgroundedAtMillis ?: return false
        backgroundedAtMillis = null
        return nowMillis() - backgroundedAt >= timeoutMillis
    }
}
