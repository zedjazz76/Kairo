package kairo.platform.vault

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.ObjectInputStream
import java.io.ObjectOutputStream
import java.io.Serializable
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Instant
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kairo.domain.ExtractionStatus
import kairo.domain.Source
import kairo.domain.SourceClassification
import kairo.domain.SourceId
import kairo.domain.SourceOrigin
import kairo.domain.SourceType
import kairo.domain.SourceVariant
import kairo.domain.SourceVariantId

class EncryptedSourceVault(private val root: Path, private val keyProvider: MasterKeyProvider) : SourceVault {
    private val blobs = root.resolve("blobs")
    private val manifest = root.resolve("vault.manifest")
    init { Files.createDirectories(blobs) }

    override fun importDurable(bytes: ByteArray, metadata: SourceImportMetadata): VaultImport = synchronized(this) {
        val state = readState(); val hash = sha256(bytes); val blob = blobs.resolve(hash)
        if (!Files.exists(blob)) writeEncrypted(blob, bytes.copyOf())
        val entry = StoredImport(UUID.randomUUID().toString(), metadata.sourceId.value, metadata.importedAt.toEpochMilli(), metadata.origin.name, metadata.type.name, metadata.classification.name, metadata.displayName, metadata.evidenceIds.toList(), hash, null)
        state.imports += entry; writeState(state); toVaultImport(entry, state)
    }

    override fun createDerivative(parentImportId: String, bytes: ByteArray, importedAt: Instant): VaultImport = synchronized(this) {
        val state = readState(); val parent = state.imports.singleOrNull { it.importId == parentImportId } ?: error("Unknown parent import: $parentImportId")
        val hash = sha256(bytes); val blob = blobs.resolve(hash)
        if (!Files.exists(blob)) writeEncrypted(blob, bytes.copyOf())
        val entry = parent.copy(importId = UUID.randomUUID().toString(), importedAtMillis = importedAt.toEpochMilli(), contentHash = hash, parentImportId = parent.importId)
        state.imports += entry; writeState(state); toVaultImport(entry, state)
    }

    override fun open(importId: String): ByteArray = synchronized(this) {
        val entry = readState().imports.singleOrNull { it.importId == importId } ?: error("Unknown import: $importId")
        readEncrypted(blobs.resolve(entry.contentHash))
    }

    override fun imports(): List<VaultImport> = synchronized(this) { val state = readState(); state.imports.map { toVaultImport(it, state) } }
    override fun stats(): VaultStats = synchronized(this) { val state = readState(); VaultStats(state.imports.map { it.contentHash }.toSet().size, state.imports.size) }
    internal fun archiveEntries(): List<ArchiveEntry> = synchronized(this) { val state = readState(); state.imports.map { ArchiveEntry(it, readEncrypted(blobs.resolve(it.contentHash))) } }

    internal fun importArchive(entries: List<ArchiveEntry>) = synchronized(this) {
        val state = readState()
        require(entries.map { it.entry.importId }.toSet().size == entries.size) { "Archive contains duplicate import IDs" }
        require(entries.none { incoming -> state.imports.any { it.importId == incoming.entry.importId } }) { "Archive import already exists" }
        entries.forEach { item ->
            val blob = blobs.resolve(item.entry.contentHash)
            if (!Files.exists(blob)) writeEncrypted(blob, item.bytes.copyOf())
        }
        state.imports += entries.map { it.entry }
        writeState(state)
    }

    private fun toVaultImport(entry: StoredImport, state: StoredState): VaultImport {
        val entries = state.imports.filter { it.sourceId == entry.sourceId }.sortedBy { it.importedAtMillis }
        val variants = entries.mapIndexed { index, item -> SourceVariant(SourceVariantId(item.importId), SourceId(item.sourceId), index + 1, item.contentHash, Instant.ofEpochMilli(item.importedAtMillis), item.parentImportId?.let(::SourceVariantId), ExtractionStatus.NOT_REQUESTED, emptySet()) }
        val rootEntry = entries.single { it.parentImportId == null }
        val source = Source(SourceId(entry.sourceId), SourceOrigin.valueOf(rootEntry.origin), SourceType.valueOf(rootEntry.type), rootEntry.contentHash, Instant.ofEpochMilli(rootEntry.importedAtMillis), SourceClassification.valueOf(rootEntry.classification), variants, emptySet())
        return VaultImport(entry.importId, entry.contentHash, source, variants.single { it.id.value == entry.importId }, entry.toMetadata())
    }
    private fun readState(): StoredState = if (Files.exists(manifest)) deserialize(readEncrypted(manifest)) else StoredState()
    private fun writeState(state: StoredState) = writeEncrypted(manifest, serialize(state))
    private fun writeEncrypted(path: Path, plain: ByteArray) { Files.createDirectories(path.parent); val temp = path.resolveSibling("${path.fileName}.tmp"); Files.write(temp, encrypt(plain, keyProvider.masterKey())); Files.move(temp, path, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE) }
    private fun readEncrypted(path: Path): ByteArray = decrypt(Files.readAllBytes(path), keyProvider.masterKey())
}

class CacheBackedTemporarySessionStore(private val root: Path, private val keyProvider: MasterKeyProvider) : TemporarySessionStore {
    private val manifest = root.resolve("sessions.manifest")
    init { Files.createDirectories(root) }
    override fun put(sessionId: String, bytes: ByteArray) = synchronized(this) { require(sessionId.isNotBlank()); val ids = readIds() + sessionId; Files.write(fileFor(sessionId), encrypt(bytes.copyOf(), keyProvider.masterKey())); Files.write(manifest, encrypt(serialize(LinkedHashSet(ids)), keyProvider.masterKey())); Unit }
    override fun open(sessionId: String): ByteArray? = synchronized(this) { fileFor(sessionId).takeIf(Files::exists)?.let { decrypt(Files.readAllBytes(it), keyProvider.masterKey()) } }
    override fun sessionIds(): Set<String> = synchronized(this) { readIds() }
    override fun delete(sessionId: String) = synchronized(this) { Files.deleteIfExists(fileFor(sessionId)); writeIds(readIds() - sessionId); Unit }
    override fun clear() = synchronized(this) { readIds().forEach { Files.deleteIfExists(fileFor(it)) }; Files.deleteIfExists(manifest); Unit }
    private fun fileFor(id: String): Path = root.resolve(sha256(id.encodeToByteArray()))
    private fun readIds(): Set<String> = if (Files.exists(manifest)) deserialize(decrypt(Files.readAllBytes(manifest), keyProvider.masterKey())) else emptySet()
    private fun writeIds(ids: Set<String>) { if (ids.isEmpty()) Files.deleteIfExists(manifest) else Files.write(manifest, encrypt(serialize(LinkedHashSet(ids)), keyProvider.masterKey())) }
}

internal data class ArchiveEntry(val entry: StoredImport, val bytes: ByteArray) : Serializable
internal data class StoredState(val imports: MutableList<StoredImport> = mutableListOf()) : Serializable
internal data class StoredImport(val importId: String, val sourceId: String, val importedAtMillis: Long, val origin: String, val type: String, val classification: String, val displayName: String, val evidenceIds: List<String>, val contentHash: String, val parentImportId: String?) : Serializable {
    fun toMetadata() = SourceImportMetadata(SourceId(sourceId), Instant.ofEpochMilli(importedAtMillis), SourceOrigin.valueOf(origin), SourceType.valueOf(type), SourceClassification.valueOf(classification), displayName, evidenceIds.toSet())
}
internal fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
internal fun encrypt(plain: ByteArray, key: SecretKey): ByteArray { val iv = ByteArray(12).also(SecureRandom()::nextBytes); val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(128, iv)) }; return iv + cipher.doFinal(plain) }
internal fun decrypt(payload: ByteArray, key: SecretKey): ByteArray { require(payload.size > 12); val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, payload.copyOfRange(0, 12))) }; return cipher.doFinal(payload.copyOfRange(12, payload.size)) }
internal fun serialize(value: Serializable): ByteArray = ByteArrayOutputStream().use { bytes -> ObjectOutputStream(bytes).use { it.writeObject(value) }; bytes.toByteArray() }
@Suppress("UNCHECKED_CAST") internal fun <T> deserialize(bytes: ByteArray): T = ObjectInputStream(ByteArrayInputStream(bytes)).use { it.readObject() as T }
