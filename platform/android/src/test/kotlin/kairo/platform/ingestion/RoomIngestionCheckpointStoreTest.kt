package kairo.platform.ingestion

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.work.ListenableWorker
import androidx.work.workDataOf
import androidx.work.testing.TestListenableWorkerBuilder
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
import kairo.security.SensitiveContentKind
import kairo.security.SensitiveContentMatch
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

    @Test
    fun `worker factory reconstructs runtime and resumes extracted checkpoint without re-extraction`() {
        var extractions = 0
        val firstDatabase = openDatabase()
        val firstCheckpoints = RoomIngestionCheckpointStore(firstDatabase)
        val firstPayloads = TemporarySessionIngestionPayloadStore(
            CacheBackedTemporarySessionStore(temporaryRoot, FixedMasterKeyProvider(testKey)),
        )
        assertFailsWith<SimulatedProcessDeath> {
            IngestionPipeline(
                extractors = listOf(CountingTextExtractor { extractions += 1 }),
                scanner = { SensitiveContentScan(emptyList()) },
                checkpoints = ProcessDeathAfterExtraction(firstCheckpoints),
                payloads = firstPayloads,
            ).run(
                IngestionRequest(
                    sessionId = sessionId,
                    artifacts = listOf(artifact("PACS ONLINE")),
                    capturedAt = Instant.parse("2026-08-21T12:00:00Z"),
                ),
            )
        }
        assertEquals(IngestionStage.EXTRACTED, firstCheckpoints.load(sessionId)?.stage)
        firstDatabase.close()
        database = null

        var runtimeCreations = 0
        val runtimeFactory = object : IngestionRuntimeFactory {
            override fun create(): IngestionPipeline {
                runtimeCreations += 1
                val restartedDatabase = openDatabase()
                return IngestionPipeline(
                    extractors = listOf(CountingTextExtractor { extractions += 1 }),
                    scanner = { SensitiveContentScan(emptyList()) },
                    checkpoints = RoomIngestionCheckpointStore(restartedDatabase),
                    payloads = TemporarySessionIngestionPayloadStore(
                        CacheBackedTemporarySessionStore(temporaryRoot, FixedMasterKeyProvider(testKey)),
                    ),
                )
            }
        }
        val worker = TestListenableWorkerBuilder<KairoIngestionWorker>(context)
            .setWorkerFactory(KairoWorkerFactory(runtimeFactory))
            .setInputData(workDataOf(IngestionWorkScheduler.SESSION_ID to sessionId.value))
            .build()

        val result = worker.doWork()

        assertEquals(ListenableWorker.Result.success(), result)
        assertEquals(1, runtimeCreations)
        assertEquals(1, extractions)
        assertEquals(IngestionStage.COMPLETE, RoomIngestionCheckpointStore(requireNotNull(database)).load(sessionId)?.stage)
    }

    @Test
    fun `phi review checkpoint remains available and worker does not retry`() {
        var extractions = 0
        val sensitiveScan = SensitiveContentScan(
            listOf(SensitiveContentMatch(SensitiveContentKind.MRN, 0, 11)),
        )
        val firstDatabase = openDatabase()
        val firstCheckpoints = RoomIngestionCheckpointStore(firstDatabase)
        val temporaryStore = CacheBackedTemporarySessionStore(temporaryRoot, FixedMasterKeyProvider(testKey))
        val paused = IngestionPipeline(
            extractors = listOf(CountingTextExtractor { extractions += 1 }),
            scanner = { sensitiveScan },
            checkpoints = firstCheckpoints,
            payloads = TemporarySessionIngestionPayloadStore(temporaryStore),
        ).run(
            IngestionRequest(
                sessionId = sessionId,
                artifacts = listOf(artifact("MRN: 123456")),
                capturedAt = Instant.parse("2026-08-21T12:00:00Z"),
            ),
        )
        assertEquals(IngestionStage.PHI_REVIEW_REQUIRED, paused.stage)
        val payloadReferences = temporaryStore.sessionIds()
        firstDatabase.close()
        database = null

        val runtimeFactory = object : IngestionRuntimeFactory {
            override fun create(): IngestionPipeline {
                val restartedDatabase = openDatabase()
                return IngestionPipeline(
                    extractors = listOf(CountingTextExtractor { extractions += 1 }),
                    scanner = { sensitiveScan },
                    checkpoints = RoomIngestionCheckpointStore(restartedDatabase),
                    payloads = TemporarySessionIngestionPayloadStore(
                        CacheBackedTemporarySessionStore(temporaryRoot, FixedMasterKeyProvider(testKey)),
                    ),
                )
            }
        }
        val worker = TestListenableWorkerBuilder<KairoIngestionWorker>(context)
            .setWorkerFactory(KairoWorkerFactory(runtimeFactory))
            .setInputData(workDataOf(IngestionWorkScheduler.SESSION_ID to sessionId.value))
            .build()

        val result = worker.doWork()

        assertEquals(ListenableWorker.Result.success(), result)
        assertEquals(IngestionStage.PHI_REVIEW_REQUIRED, RoomIngestionCheckpointStore(requireNotNull(database)).load(sessionId)?.stage)
        assertEquals(payloadReferences, CacheBackedTemporarySessionStore(temporaryRoot, FixedMasterKeyProvider(testKey)).sessionIds())
        assertEquals(1, extractions)
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
