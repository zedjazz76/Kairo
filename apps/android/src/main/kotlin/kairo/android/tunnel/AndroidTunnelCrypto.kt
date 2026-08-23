package kairo.android.tunnel

import java.nio.charset.StandardCharsets
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.PrivateKey
import java.security.PublicKey
import java.security.SecureRandom
import java.security.spec.ECGenParameterSpec
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyAgreement
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

data class TunnelFrameMetadata(
    val sessionId: String,
    val sequence: Long,
    val expiresAt: Long,
)

object AndroidTunnelCrypto {
    private const val CURVE = "secp256r1"
    private const val HKDF_INFO = "kairo-v1-paired-tunnel"
    private const val AES_KEY_BYTES = 32
    private const val GCM_TAG_BITS = 128
    private const val GCM_NONCE_BYTES = 12

    private val secureRandom = SecureRandom()

    fun createEphemeralKeyPair(): KeyPair {
        return KeyPairGenerator.getInstance("EC").apply {
            initialize(ECGenParameterSpec(CURVE), secureRandom)
        }.generateKeyPair()
    }

    fun deriveSessionKey(
        privateKey: PrivateKey,
        peerPublicKey: PublicKey,
        salt: ByteArray,
    ): ByteArray {
        val agreement = KeyAgreement.getInstance("ECDH")
        agreement.init(privateKey)
        agreement.doPhase(peerPublicKey, true)
        val sharedSecret = agreement.generateSecret()

        return hkdfSha256(
            inputKeyMaterial = sharedSecret,
            salt = salt,
            info = HKDF_INFO.toByteArray(StandardCharsets.UTF_8),
            outputLength = AES_KEY_BYTES,
        )
    }

    fun encryptFrame(
        sessionKey: ByteArray,
        metadata: TunnelFrameMetadata,
        plaintext: String,
    ): TunnelFrame {
        require(sessionKey.size == AES_KEY_BYTES) { "invalid_session_key" }

        val nonce = ByteArray(GCM_NONCE_BYTES).also(secureRandom::nextBytes)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.ENCRYPT_MODE,
            SecretKeySpec(sessionKey, "AES"),
            GCMParameterSpec(GCM_TAG_BITS, nonce),
        )
        cipher.updateAAD(authenticatedMetadata(metadata))
        val encrypted = cipher.doFinal(plaintext.toByteArray(StandardCharsets.UTF_8))

        return TunnelFrame(
            sessionId = metadata.sessionId,
            sequence = metadata.sequence,
            expiresAt = metadata.expiresAt,
            nonce = Base64.getEncoder().encodeToString(nonce),
            ciphertext = Base64.getEncoder().encodeToString(encrypted),
        )
    }

    fun decryptFrame(
        sessionKey: ByteArray,
        frame: TunnelFrame,
    ): String {
        require(sessionKey.size == AES_KEY_BYTES) { "invalid_session_key" }

        val metadata = TunnelFrameMetadata(
            sessionId = frame.sessionId,
            sequence = frame.sequence,
            expiresAt = frame.expiresAt,
        )
        val nonce = Base64.getDecoder().decode(frame.nonce)
        val ciphertext = Base64.getDecoder().decode(frame.ciphertext)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.DECRYPT_MODE,
            SecretKeySpec(sessionKey, "AES"),
            GCMParameterSpec(GCM_TAG_BITS, nonce),
        )
        cipher.updateAAD(authenticatedMetadata(metadata))

        return String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8)
    }

    private fun authenticatedMetadata(metadata: TunnelFrameMetadata): ByteArray {
        return "{\"sessionId\":\"${jsonEscape(metadata.sessionId)}\",\"sequence\":${metadata.sequence},\"expiresAt\":${metadata.expiresAt}}"
            .toByteArray(StandardCharsets.UTF_8)
    }

    private fun hkdfSha256(
        inputKeyMaterial: ByteArray,
        salt: ByteArray,
        info: ByteArray,
        outputLength: Int,
    ): ByteArray {
        val hmac = Mac.getInstance("HmacSHA256")
        val effectiveSalt = if (salt.isEmpty()) ByteArray(32) else salt
        hmac.init(SecretKeySpec(effectiveSalt, "HmacSHA256"))
        val pseudoRandomKey = hmac.doFinal(inputKeyMaterial)

        val output = ByteArray(outputLength)
        var previous = ByteArray(0)
        var offset = 0
        var counter = 1

        while (offset < outputLength) {
            hmac.init(SecretKeySpec(pseudoRandomKey, "HmacSHA256"))
            hmac.update(previous)
            hmac.update(info)
            hmac.update(counter.toByte())
            previous = hmac.doFinal()

            val copyLength = minOf(previous.size, outputLength - offset)
            previous.copyInto(output, destinationOffset = offset, endIndex = copyLength)
            offset += copyLength
            counter += 1
        }

        return output
    }

    private fun jsonEscape(value: String): String {
        return buildString(value.length) {
            value.forEach { character ->
                when (character) {
                    '\\' -> append("\\\\")
                    '"' -> append("\\\"")
                    '\b' -> append("\\b")
                    '\u000C' -> append("\\f")
                    '\n' -> append("\\n")
                    '\r' -> append("\\r")
                    '\t' -> append("\\t")
                    else -> {
                        if (character.code < 0x20) {
                            append("\\u")
                            append(character.code.toString(16).padStart(4, '0'))
                        } else {
                            append(character)
                        }
                    }
                }
            }
        }
    }
}
