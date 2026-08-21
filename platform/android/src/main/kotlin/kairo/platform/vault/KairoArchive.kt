package kairo.platform.vault

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.ObjectInputStream
import java.io.ObjectOutputStream
import java.io.Serializable
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec

data class ArchiveImportResult(val evidenceIds: Set<String>, val temporarySessionIds: Set<String>)

class KairoArchive(private val vault: EncryptedSourceVault, private val temporaryStore: TemporarySessionStore) {
    fun exportEncrypted(passphrase: CharArray): ByteArray {
        val payload = ArchivePayload(vault.archiveEntries())
        val bytes = ByteArrayOutputStream().use { out -> ObjectOutputStream(out).use { it.writeObject(payload) }; out.toByteArray() }
        return encryptArchive(bytes, passphrase)
    }

    fun importEncrypted(bytes: ByteArray, passphrase: CharArray): ArchiveImportResult {
        val plain = decryptArchive(bytes, passphrase)
        val payload = ObjectInputStream(ByteArrayInputStream(plain)).use { it.readObject() as ArchivePayload }
        require(payload.entries.all { sha256(it.bytes) == it.entry.contentHash }) { "Archive hash validation failed" }
        vault.importArchive(payload.entries)
        return ArchiveImportResult(payload.entries.flatMap { it.entry.evidenceIds }.toSet(), emptySet())
    }
}

private data class ArchivePayload(val entries: List<ArchiveEntry>) : Serializable
private fun encryptArchive(plain: ByteArray, passphrase: CharArray): ByteArray { val salt = ByteArray(16).also(SecureRandom()::nextBytes); val iv = ByteArray(12).also(SecureRandom()::nextBytes); val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, archiveKey(passphrase, salt), GCMParameterSpec(128, iv)) }; return salt + iv + cipher.doFinal(plain) }
private fun decryptArchive(payload: ByteArray, passphrase: CharArray): ByteArray { if (payload.size <= 28) throw SecurityException("Archive is invalid"); return try { val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, archiveKey(passphrase, payload.copyOfRange(0, 16)), GCMParameterSpec(128, payload.copyOfRange(16, 28))) }; cipher.doFinal(payload.copyOfRange(28, payload.size)) } catch (error: Exception) { throw SecurityException("Archive authentication failed", error) } }
private fun archiveKey(passphrase: CharArray, salt: ByteArray) = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(PBEKeySpec(passphrase, salt, 210_000, 256)).let { javax.crypto.spec.SecretKeySpec(it.encoded, "AES") }
