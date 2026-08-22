package kairo.platform.vault

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.time.Instant
import java.security.KeyStore
import java.util.Collections
import java.util.LinkedHashSet
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import kairo.domain.Source
import kairo.domain.SourceClassification
import kairo.domain.SourceId
import kairo.domain.SourceOrigin
import kairo.domain.SourceType
import kairo.domain.SourceVariant

interface MasterKeyProvider { fun masterKey(): SecretKey }
class FixedMasterKeyProvider(private val key: SecretKey) : MasterKeyProvider { override fun masterKey(): SecretKey = key }

/** Supplies the durable vault key from the device Android Keystore. */
class AndroidKeystoreMasterKeyProvider(
    private val alias: String = "kairo.source-vault.master-key",
) : MasterKeyProvider {
    override fun masterKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        return (keyStore.getKey(alias, null) as? SecretKey) ?: createKey()
    }

    private fun createKey(): SecretKey {
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generator.generateKey()
    }

    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
    }
}

class SourceImportMetadata(
    val sourceId: SourceId, val importedAt: Instant, val origin: SourceOrigin, val type: SourceType,
    val classification: SourceClassification, val displayName: String, evidenceIds: Set<String> = emptySet(),
) {
    val evidenceIds: Set<String> = Collections.unmodifiableSet(LinkedHashSet(evidenceIds))
    init { require(displayName.isNotBlank()) { "displayName must not be blank" } }
}

data class VaultImport(val importId: String, val contentHash: String, val source: Source, val variant: SourceVariant, val metadata: SourceImportMetadata)
data class VaultStats(val blobCount: Int, val importCount: Int)

interface SourceVault {
    fun importDurable(bytes: ByteArray, metadata: SourceImportMetadata): VaultImport
    fun createDerivative(parentImportId: String, bytes: ByteArray, importedAt: Instant): VaultImport
    fun open(importId: String): ByteArray
    fun imports(): List<VaultImport>
    fun stats(): VaultStats
}

interface TemporarySessionStore {
    fun put(sessionId: String, bytes: ByteArray)
    fun open(sessionId: String): ByteArray?
    fun sessionIds(): Set<String>
    fun delete(sessionId: String)
    fun clear()
}
