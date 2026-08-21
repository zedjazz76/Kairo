package kairo.platform.ingestion

import kairo.domain.CaptureSessionId
import kairo.ingestion.IngestionPipeline
import kairo.ingestion.IngestionRequest
import kairo.ingestion.IngestionResult
import kairo.ingestion.SensitiveChoice

/** Android host adapter; WorkManager scheduling is supplied by the app host. */
class IngestionWorker(private val pipeline: IngestionPipeline) {
    fun run(request: IngestionRequest): IngestionResult = pipeline.run(request)

    fun resume(sessionId: CaptureSessionId, choice: SensitiveChoice): IngestionResult =
        pipeline.resume(sessionId, choice)
}
