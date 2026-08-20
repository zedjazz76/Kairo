package kairo.platform.vault

import java.nio.file.Files
import java.time.Instant
import javax.crypto.spec.SecretKeySpec
import kairo.domain.SourceClassification
import kairo.domain.SourceId
import kairo.domain.SourceOrigin
import kairo.domain.SourceType
import kotlinx.coroutines.test.runTest
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import kotlin.io.path.isRegularFile
import kotlin.io.path.readBytes
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SourceVaultTest {
    @get:Rule
    val temporaryFolder = TemporaryFolder()

    private val keyProvider = FixedMasterKeyProvider(
        SecretKeySpec(ByteArray(32) { index -> (index + 1).toByte() }, "AES"),
    )

    @Test
    fun `same bytes share encrypted blob but retain import records`() = runTest {
        val vault = vault("dedup")
        val bytes = "AbbaDox routing notes".encodeToByteArray()

        val first = vault.importDurable(bytes, metadata("source-a", "meeting-a.docx"))
        val second = vault.importDurable(bytes, metadata("source-b", "meeting-b.docx"))

        assertEquals(first.contentHash, second.contentHash)
        assertNotEquals(first.importId, second.importId)
        assertEquals(1, vault.stats().blobCount)
        assertEquals(2, vault.stats().importCount)
        assertContentEquals(bytes, vault.open(first.importId))
        assertContentEquals(bytes, vault.open(second.importId))
    }

    @Test
    fun `vault snapshots caller bytes and returns defensive copies`() = runTest {
        val vault = vault("immutability")
        val original = "immutable original".encodeToByteArray()
        val expected = original.copyOf()
        val imported = vault.importDurable(original, metadata("immutable-source", "original.txt"))

        original.fill(0)
        val opened = vault.open(imported.importId)!!
        opened.fill(1)

        assertContentEquals(expected, vault.open(imported.importId))
    }

    @Test
    fun `redacted derivative retains lineage without replacing original`() = runTest {
        val vault = vault("derivative")
        val originalBytes = "Patient: Jane Doe MRN: 123456".encodeToByteArray()
        val redactedBytes = "Patient: [REDACTED] MRN: [REDACTED]".encodeToByteArray()
        val original = vault.importDurable(
            originalBytes,
            metadata("source-derivative", "incident.txt", SourceClassification.RESTRICTED),
        )

        val derivative = vault.createDerivative(
            original.importId,
            redactedBytes,
            importedAt = Instant.parse("2026-08-20T10:30:00Z"),
        )

        assertEquals(original.source.id, derivative.source.id)
        assertEquals(original.variant.id, derivative.variant.parentVariantId)
        assertEquals(2, derivative.variant.version)
        assertNotEquals(original.contentHash, derivative.contentHash)
        assertContentEquals(originalBytes, vault.open(original.importId))
        assertContentEquals(redactedBytes, vault.open(derivative.importId))
        assertEquals(listOf(1, 2), derivative.source.variants.map { it.version })
    }

    @Test
    fun `durable bytes and metadata are encrypted at rest and survive restart`() = runTest {
        val root = temporaryFolder.newFolder("restart").toPath()
        val vault = EncryptedSourceVault(root, keyProvider)
        val secret = "plaintext clinical systems evidence".encodeToByteArray()
        val imported = vault.importDurable(secret, metadata("restart-source", "plain-secret.txt"))

        Files.walk(root).use { paths ->
            val storedBytes = paths
                .filter { it.isRegularFile() }
                .map { it.readBytes() }
                .toList()
            assertTrue(storedBytes.isNotEmpty())
            assertTrue(storedBytes.none { it.containsSequence(secret) })
            assertTrue(storedBytes.none { it.containsSequence("plain-secret.txt".encodeToByteArray()) })
        }

        val restarted = EncryptedSourceVault(root, keyProvider)
        assertContentEquals(secret, restarted.open(imported.importId))
        assertEquals(imported.contentHash, restarted.imports().single().contentHash)
    }

    @Test
    fun `encrypted archive preserves evidence and excludes temporary sessions`() = runTest {
        val sourceVault = vault("archive-source")
        val temporaryStore = temporaryStore("archive-temporary")
        val imported = sourceVault.importDurable(
            "durable evidence".encodeToByteArray(),
            metadata("archive-source", "evidence.pdf", evidenceIds = setOf("evidence-1", "evidence-2")),
        )
        temporaryStore.put("temporary-patient-session", "MRN 123456".encodeToByteArray())
        val archive = KairoArchive(sourceVault, temporaryStore)
        val encrypted = archive.exportEncrypted("correct horse battery staple".toCharArray())

        val restoredVault = vault("archive-target")
        val restoredTemporaryStore = temporaryStore("archive-target-temporary")
        val restored = KairoArchive(restoredVault, restoredTemporaryStore).importEncrypted(
            encrypted,
            "correct horse battery staple".toCharArray(),
        )

        assertEquals(setOf("evidence-1", "evidence-2"), restored.evidenceIds)
        assertTrue(restored.temporarySessionIds.isEmpty())
        assertContentEquals("durable evidence".encodeToByteArray(), restoredVault.open(imported.importId))
        assertTrue(restoredTemporaryStore.sessionIds().isEmpty())
    }

    @Test
    fun `archive authentication failure leaves target vault unchanged`() = runTest {
        val sourceVault = vault("archive-tamper-source")
        sourceVault.importDurable(
            "authenticated evidence".encodeToByteArray(),
            metadata("tamper-source", "evidence.txt", evidenceIds = setOf("evidence-tamper")),
        )
        val encrypted = KairoArchive(sourceVault, temporaryStore("archive-tamper-temp"))
            .exportEncrypted("passphrase".toCharArray())
        encrypted[encrypted.lastIndex] = (encrypted.last() xor 0x01)

        val targetVault = vault("archive-tamper-target")
        val targetArchive = KairoArchive(targetVault, temporaryStore("archive-tamper-target-temp"))

        assertFailsWith<SecurityException> {
            targetArchive.importEncrypted(encrypted, "passphrase".toCharArray())
        }
        assertEquals(VaultStats(blobCount = 0, importCount = 0), targetVault.stats())
    }

    @Test
    fun `wrong archive passphrase leaves target vault unchanged`() = runTest {
        val sourceVault = vault("archive-password-source")
        sourceVault.importDurable(
            "encrypted evidence".encodeToByteArray(),
            metadata("password-source", "evidence.txt"),
        )
        val encrypted = KairoArchive(sourceVault, temporaryStore("archive-password-temp"))
            .exportEncrypted("right passphrase".toCharArray())
        val targetVault = vault("archive-password-target")

        assertFailsWith<SecurityException> {
            KairoArchive(targetVault, temporaryStore("archive-password-target-temp"))
                .importEncrypted(encrypted, "wrong passphrase".toCharArray())
        }
        assertEquals(VaultStats(blobCount = 0, importCount = 0), targetVault.stats())
    }

    @Test
    fun `temporary store survives process recreation but is clearable and never durable`() = runTest {
        val root = temporaryFolder.newFolder("temporary-restart").toPath()
        val firstProcess = CacheBackedTemporarySessionStore(root, keyProvider)
        firstProcess.put("session-1", "Patient: Jane Doe".encodeToByteArray())

        val restarted = CacheBackedTemporarySessionStore(root, keyProvider)
        assertContentEquals("Patient: Jane Doe".encodeToByteArray(), restarted.open("session-1"))
        restarted.clear()

        val afterClear = CacheBackedTemporarySessionStore(root, keyProvider)
        assertTrue(afterClear.sessionIds().isEmpty())
        assertNull(afterClear.open("session-1"))
    }

    private fun vault(name: String) = EncryptedSourceVault(
        temporaryFolder.newFolder(name).toPath(),
        keyProvider,
    )

    private fun temporaryStore(name: String) = CacheBackedTemporarySessionStore(
        temporaryFolder.newFolder(name).toPath(),
        keyProvider,
    )

    private fun metadata(
        sourceId: String,
        displayName: String,
        classification: SourceClassification = SourceClassification.CONFIDENTIAL,
        evidenceIds: Set<String> = emptySet(),
    ) = SourceImportMetadata(
        sourceId = SourceId(sourceId),
        importedAt = Instant.parse("2026-08-20T10:00:00Z"),
        origin = SourceOrigin.IMPORT,
        type = SourceType.DOCUMENT,
        classification = classification,
        displayName = displayName,
        evidenceIds = evidenceIds,
    )
}

private fun ByteArray.containsSequence(candidate: ByteArray): Boolean =
    candidate.isNotEmpty() && indices.any { start ->
        start + candidate.size <= size && candidate.indices.all { offset -> this[start + offset] == candidate[offset] }
    }

private infix fun Byte.xor(value: Int): Byte = (toInt() xor value).toByte()
