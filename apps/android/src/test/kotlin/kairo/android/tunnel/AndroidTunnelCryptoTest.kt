package kairo.android.tunnel

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Test

class AndroidTunnelCryptoTest {

    @Test
    fun `paired peers derive compatible keys and encrypted frame hides plaintext`() {
        val browserPeer = AndroidTunnelCrypto.createEphemeralKeyPair()
        val corePeer = AndroidTunnelCrypto.createEphemeralKeyPair()
        val salt = ByteArray(32) { index -> (index + 1).toByte() }

        val browserKey = AndroidTunnelCrypto.deriveSessionKey(
            privateKey = browserPeer.privateKey,
            peerPublicKey = corePeer.publicKey,
            salt = salt,
        )
        val coreKey = AndroidTunnelCrypto.deriveSessionKey(
            privateKey = corePeer.privateKey,
            peerPublicKey = browserPeer.publicKey,
            salt = salt,
        )

        assertEquals(browserKey.toList(), coreKey.toList())

        val plaintext = "{\"type\":\"ASK_KAIRO\",\"question\":\"What is AbbaDox routing?\"}"
        val metadata = TunnelFrameMetadata(
            sessionId = "session-1",
            sequence = 1,
            expiresAt = 1_725_000_060_000,
        )

        val frame = AndroidTunnelCrypto.encryptFrame(
            sessionKey = browserKey,
            metadata = metadata,
            plaintext = plaintext,
        )

        assertFalse(frame.ciphertext.contains("AbbaDox"))
        assertNotEquals(plaintext, frame.ciphertext)
        assertEquals(
            plaintext,
            AndroidTunnelCrypto.decryptFrame(coreKey, frame),
        )
    }

    @Test
    fun `authenticated metadata tampering is rejected`() {
        val first = AndroidTunnelCrypto.createEphemeralKeyPair()
        val second = AndroidTunnelCrypto.createEphemeralKeyPair()
        val salt = ByteArray(32) { index -> (index + 7).toByte() }
        val firstKey = AndroidTunnelCrypto.deriveSessionKey(first.privateKey, second.publicKey, salt)
        val secondKey = AndroidTunnelCrypto.deriveSessionKey(second.privateKey, first.publicKey, salt)

        val frame = AndroidTunnelCrypto.encryptFrame(
            sessionKey = firstKey,
            metadata = TunnelFrameMetadata(
                sessionId = "session-1",
                sequence = 1,
                expiresAt = 1_725_000_060_000,
            ),
            plaintext = "sensitive payload",
        )

        val tampered = frame.copy(sequence = 2)
        val failure = runCatching {
            AndroidTunnelCrypto.decryptFrame(secondKey, tampered)
        }.exceptionOrNull()

        requireNotNull(failure)
    }
}
