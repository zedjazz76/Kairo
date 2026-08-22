package kairo.platform.ingestion

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import java.time.Instant
import javax.crypto.spec.SecretKeySpec
import kairo.domain.AnchorLocator
import kairo.domain.CaptureSessionId
import kairo.domain.SourceAnchor
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.ingestion.ArtifactExtractor
import kairo.ingestion.ArtifactFormat
import kairo.ingestion.ExtractedArtifact
import kairo.ingestion.IngestionArtifact
import kairo.ingestion.IngestionCheckpoint
import kairo.ingestion.IngestionCheckpointStore
import kairo.ingestion.IngestionPipeline
import kairo.ingestion.IngestionRequest
import kairo.ingestion.IngestionStage
import kairo.platform.db.KairoDatabase
import kairo.platform.vault.CacheBackedTemporarySessionStore
import kairo.platform.vault.FixedMasterKeyProvider
import kairo.security.SensitiveContentScan
import org.junit.After
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import kotlin.io.path.createTempDirectory
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class RoomIngestionCheckpointStoreTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val databaseName = "ingestion-checkpoint-${System.nanoTime()}.db"
    private val temporaryRoot = createTempDirectory("kairo-ingestion-checkpoint")
    private val sessionId = CaptureSessionId("checkpoint-restart")
    private var database: KairoDatabase? = null

    @After
    fun tearDown() {
        database?.close()
        context.deleteDatabase(databaseName)
        temporaryRoot.toFile().deleteRecursively()
    }

    @Test
    fun `restart resumes encrypted extracted payload without repeating extraction`() {
        var extractions = 0
        val firstDatabase = openDatabase()
        val firstCheckpoints = RoomIngestionCheckpointStore(firstDatabase)
        val firstPayloads = TemporarySessionIngestionPayloadStore(
            CacheBackedTemporarySessionStore(temporaryRoot, FixedMasterKeyProvider(testKey)),
        )
        val request = IngestionRequest(
            sessionId = sessionId,
            artifacts = listOf(artifact("PACS ONLINE")),
            capturedAt = Instant.parse("2026-08-21T12:00:00Z"),
        )

        assertFailsWith<SimulatedProcessDeath> {
            IngestionPipeline(
                extractors = listOf(CountingTextExtractor { extractions += 1 }),
                scanner = { SensitiveContentScan(emptyList()) },
                checkpoints = ProcessDeathAfterExtraction(firstCheckpoints),
                payloads = firstPayloads,
            ).run(request)
        }
        assertEquals(1, extractions)
        assertEquals(IngestionStage.EXTRACTED, firstCheckpoints.load(sessionId)?.stage)
        firstDatabase.close()
        database = null

        val restartedDatabase = openDatabase()
        val restartedCheckpoints = RoomIngestionCheckpointStore(restartedDatabase)
        val resumed = IngestionPipeline(
            extractors = listOf(CountingTextExtractor { extractions += 1 }),
            scanner = { SensitiveContentScan(emptyList()) },
            checkpoints = restartedCheckpoints,
            payloads = TemporarySessionIngestionPayloadStore(
                CacheBackedTemporarySessionStore(temporaryRoot, FixedMasterKeyProvider(testKey)),
            ),
        ).resume(sessionId)

        assertEquals(IngestionStage.COMPLETE, resumed.stage)
        assertEquals(1, extractions)
        assertCheckpointMetadataExcludesPayloads(restartedDatabase, "PACS ONLINE")
    }

    private fun openDatabase(): KairoDatabase = Room.databaseBuilder(context, KairoDatabase::class.java, databaseName)
        .allowMainThreadQueries()
        .build()
        .also { database = it }

    private fun assertCheckpointMetadataExcludesPayloads(openedDatabase: KairoDatabase, extractedText: String) {
        openedDatabase.openHelper.writableDatabase.query("SELECT * FROM ingestion_checkpoints").use { cursor ->
            assertFalse(cursor.columnNames.any { it.contains("bytes", ignoreCase = true) || it.contains("text", ignoreCase = true) })
        }
        openedDatabase.close()
        database = null
        assertFalse(context.getDatabasePath(databaseName).readBytes().contains(extractedText.encodeToByteArray()))
    }

    private fun artifact(text: String) = IngestionArtifact(
        sourceId = SourceId("checkpoint-source"),
        variantId = SourceVariantId("checkpoint-source-v1"),
        fileName = "status.txt",
        bytes = text.encodeToByteArray(),
    )

    private companion object {
        val testKey = SecretKeySpec(ByteArray(32) { (it + 1).toByte() }, "AES")
    }
}

private class SimulatedProcessDeath : RuntimeException()

private class ProcessDeathAfterExtraction(
    private val delegate: IngestionCheckpointStore,
) : IngestionCheckpointStore {
    override fun load(sessionId: CaptureSessionId): IngestionCheckpoint? = delegate.load(sessionId)

    override fun save(checkpoint: IngestionCheckpoint) {
        delegate.save(checkpoint)
        if (checkpoint.stage == IngestionStage.EXTRACTED) throw SimulatedProcessDeath()
    }
}

private class CountingTextExtractor(
    private val onExtract: () -> Unit,
) : ArtifactExtractor {
    override fun supports(format: ArtifactFormat) = true

    override fun extract(artifact: IngestionArtifact, format: ArtifactFormat): ExtractedArtifact {
        onExtract()
        val text = artifact.bytes.decodeToString()
        return ExtractedArtifact(
            artifact = artifact,
            format = format,
            text = text,
            anchors = setOf(SourceAnchor(artifact.sourceId, artifact.variantId, AnchorLocator.TextSpan(0, text.length))),
        )
    }
}

private fun ByteArray.contains(needle: ByteArray): Boolean =
    needle.isEmpty() || (needle.size <= size && (0..size - needle.size).any { start ->
        needle.indices.all { offset -> this[start + offset] == needle[offset] }
    })
