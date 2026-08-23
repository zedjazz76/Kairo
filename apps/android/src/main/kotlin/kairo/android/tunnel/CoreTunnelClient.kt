package kairo.android.tunnel

data class TunnelFrame(
    val sessionId: String,
    val sequence: Long,
    val expiresAt: Long,
    val nonce: String,
    val ciphertext: String,
)

interface TunnelTransport {
    fun connect(sessionId: String)
    fun send(frame: TunnelFrame)
    fun disconnect()
}

class CoreTunnelClient(
    private val transport: TunnelTransport,
) {
    private var connectedSessionId: String? = null

    fun connect(sessionId: String) {
        transport.connect(sessionId)
        connectedSessionId = sessionId
    }

    fun send(frame: TunnelFrame) {
        val sessionId = connectedSessionId
            ?: throw IllegalStateException("tunnel_not_connected")

        require(frame.sessionId == sessionId) {
            "tunnel_session_mismatch"
        }

        transport.send(frame)
    }

    fun disconnect() {
        if (connectedSessionId != null) {
            transport.disconnect()
            connectedSessionId = null
        }
    }

    fun isDisconnected(): Boolean = connectedSessionId == null
}
