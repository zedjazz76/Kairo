package kairo.android.tunnel

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CoreTunnelClientTest {

    @Test
    fun `connected client sends encrypted frame through transport and disconnects cleanly`() {
        val transport = RecordingTunnelTransport()
        val client = CoreTunnelClient(transport)
        val frame = TunnelFrame(
            sessionId = "session-1",
            sequence = 1,
            expiresAt = 1_725_000_060_000,
            nonce = "AAAAAAAAAAAAAAAA",
            ciphertext = "k4Uqj3z09Q==",
        )

        client.connect("session-1")
        client.send(frame)
        client.disconnect()

        assertEquals(listOf("session-1"), transport.connectedSessions)
        assertEquals(listOf(frame), transport.sentFrames)
        assertEquals(1, transport.disconnectCount)
        assertTrue(client.isDisconnected())
    }

    @Test
    fun `send before connect fails closed`() {
        val client = CoreTunnelClient(RecordingTunnelTransport())
        val frame = TunnelFrame(
            sessionId = "session-1",
            sequence = 1,
            expiresAt = 1_725_000_060_000,
            nonce = "AAAAAAAAAAAAAAAA",
            ciphertext = "k4Uqj3z09Q==",
        )

        val failure = runCatching { client.send(frame) }.exceptionOrNull()

        assertEquals("tunnel_not_connected", failure?.message)
    }

    private class RecordingTunnelTransport : TunnelTransport {
        val connectedSessions = mutableListOf<String>()
        val sentFrames = mutableListOf<TunnelFrame>()
        var disconnectCount = 0

        override fun connect(sessionId: String) {
            connectedSessions += sessionId
        }

        override fun send(frame: TunnelFrame) {
            sentFrames += frame
        }

        override fun disconnect() {
            disconnectCount += 1
        }
    }
}
