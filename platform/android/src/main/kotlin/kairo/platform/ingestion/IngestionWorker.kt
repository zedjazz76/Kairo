package kairo.platform.ingestion

import kairo.domain.CaptureSessionId
import kairo.ingestion.IngestionPipeline
import kairo.ingestion.IngestionRequest
import kairo.ingestion.IngestionResult
import kairo.ingestion.SensitiveChoice
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager
import android.content.Context
import androidx.work.ListenableWorker
import androidx.work.Worker
import androidx.work.WorkerFactory
import androidx.work.WorkerParameters
import androidx.room.Room
import kairo.platform.db.KairoDatabase
import kairo.platform.ingestion.extractors.defaultAndroidExtractors
import kairo.platform.security.LocalSensitiveContentScanner
import kairo.platform.vault.AndroidKeystoreMasterKeyProvider
import kairo.platform.vault.CacheBackedTemporarySessionStore

/** Android host adapter; WorkManager scheduling is supplied by the app host. */
class IngestionWorker(private val pipeline: IngestionPipeline) {
    fun run(request: IngestionRequest): IngestionResult = pipeline.run(request)

    fun resume(sessionId: CaptureSessionId, choice: SensitiveChoice): IngestionResult =
        pipeline.resume(sessionId, choice)
}

class IngestionWorkScheduler(private val workManager: WorkManager) {
    fun enqueue(sessionId: CaptureSessionId) {
        val request = OneTimeWorkRequest.Builder(KairoIngestionWorker::class.java)
            .setInputData(Data.Builder().putString(SESSION_ID, sessionId.value).build())
            .build()
        workManager.enqueueUniqueWork(uniqueName(sessionId), ExistingWorkPolicy.KEEP, request)
    }

    fun cancel(sessionId: CaptureSessionId) = workManager.cancelUniqueWork(uniqueName(sessionId))

    companion object {
        const val SESSION_ID = "sessionId"
        fun uniqueName(sessionId: CaptureSessionId) = "kairo-ingestion-${sessionId.value}"
    }
}

interface IngestionRuntimeFactory {
    fun create(): IngestionPipeline
}

class TransientIngestionException(message: String, cause: Throwable? = null) :
    RuntimeException(message, cause)

class AndroidIngestionRuntimeFactory(
    context: Context,
) : IngestionRuntimeFactory {
    private val applicationContext = context.applicationContext
    private val database by lazy {
        Room.databaseBuilder(applicationContext, KairoDatabase::class.java, DATABASE_NAME)
            .addMigrations(
                KairoDatabase.MIGRATION_1_2,
                KairoDatabase.MIGRATION_2_3,
                KairoDatabase.MIGRATION_3_4,
                KairoDatabase.MIGRATION_4_5,
                KairoDatabase.MIGRATION_5_6,
            )
            .build()
    }

    override fun create(): IngestionPipeline {
        val scanner = LocalSensitiveContentScanner()
        return IngestionPipeline(
            extractors = defaultAndroidExtractors(applicationContext),
            scanner = scanner::scan,
            checkpoints = RoomIngestionCheckpointStore(database),
            payloads = TemporarySessionIngestionPayloadStore(
                CacheBackedTemporarySessionStore(
                    applicationContext.noBackupFilesDir.toPath().resolve(TEMPORARY_PAYLOAD_DIRECTORY),
                    AndroidKeystoreMasterKeyProvider(TEMPORARY_PAYLOAD_KEY_ALIAS),
                ),
            ),
        )
    }

    private companion object {
        const val DATABASE_NAME = "kairo.db"
        const val TEMPORARY_PAYLOAD_DIRECTORY = "ingestion-temporary"
        const val TEMPORARY_PAYLOAD_KEY_ALIAS = "kairo.ingestion-temporary.master-key"
    }
}

class KairoIngestionWorker(
    context: Context,
    parameters: WorkerParameters,
    private val runtimeFactory: IngestionRuntimeFactory,
) : Worker(context, parameters) {
    override fun doWork(): Result {
        val sessionId = inputData.getString(IngestionWorkScheduler.SESSION_ID)
            ?.let(::CaptureSessionId) ?: return Result.failure()
        return try {
            when (runtimeFactory.create().resume(sessionId).stage) {
                kairo.ingestion.IngestionStage.COMPLETE,
                kairo.ingestion.IngestionStage.PHI_REVIEW_REQUIRED -> Result.success()
                else -> Result.retry()
            }
        } catch (_: TransientIngestionException) { Result.retry() }
        catch (_: Exception) { Result.failure() }
    }
}

class KairoWorkerFactory(private val runtimeFactory: IngestionRuntimeFactory) : WorkerFactory() {
    override fun createWorker(
        appContext: Context,
        workerClassName: String,
        workerParameters: WorkerParameters,
    ): ListenableWorker? = if (workerClassName == KairoIngestionWorker::class.java.name) {
        KairoIngestionWorker(appContext, workerParameters, runtimeFactory)
    } else null
}
