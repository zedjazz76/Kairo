package kairo.android.tunnel

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

class AndroidTunnelPublicKeyTest {

    @Test
    fun `public key exports as portable uncompressed P256 point and imports losslessly`() {
        val pair = AndroidTunnelCrypto.createEphemeralKeyPair()

        val exported = AndroidTunnelCrypto.exportPublicKey(pair.publicKey)
        val imported = AndroidTunnelCrypto.importPublicKey(exported)
        val roundTrip = AndroidTunnelCrypto.exportPublicKey(imported)

        assertEquals(65, exported.size)
        assertEquals(0x04, exported[0].toInt() and 0xff)
        assertArrayEquals(exported, roundTrip)
    }

    @Test
    fun `import rejects malformed public key encoding`() {
        val malformed = ByteArray(65) { 0 }

        val failure = runCatching {
            AndroidTunnelCrypto.importPublicKey(malformed)
        }.exceptionOrNull()

        assertEquals("invalid_public_key", failure?.message)
    }
}
