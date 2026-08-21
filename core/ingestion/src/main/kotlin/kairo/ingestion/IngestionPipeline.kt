package kairo.ingestion

import java.time.Instant
import kairo.domain.CaptureSessionId
import kairo.domain.SourceAnchor
import kairo.security.SensitiveContentDecision
import kairo.security.SensitiveContentPolicy
import kairo.security.SensitiveContentScan
import kairo.security.StorageDisposition
import kairo.security.UserSensitiveChoice

enum class IngestionStage {
    IMPORTED, HASHED, EXTRACTED, OCR_COMPLETE, PHI_REVIEW_REQUIRED, INDEXED, ANALYZED, CANDIDATES_CREATED, COMPLETE,
}

typealias SensitiveChoice = UserSensitiveChoice

class IngestionRequest(
    val sessionId: CaptureSessionId,
    artifacts: List<IngestionArtifact>,
    val capturedAt: Instant,
    val sensitiveChoice: SensitiveChoice? = null,
) {
    val artifacts: List<IngestionArtifact> = artifacts.toList()

    init {
        require(this.artifacts.isNotEmpty()) { "Ingestion requires at least one artifact" }
        require(this.artifacts.map { it.variantId }.toSet().size == this.artifacts.size) {
            "Ingestion artifacts must have unique source variants"
        }
    }
}

data class IngestedArtifact(
    val extracted: ExtractedArtifact,
    val sensitiveDecision: SensitiveContentDecision,
) {
    val temporaryOnly: Boolean get() = sensitiveDecision.disposition == StorageDisposition.TemporaryOnly
}

data class MemoryCandidateDraft(
    val sessionId: CaptureSessionId,
    val subjectLabel: String,
    val text: String,
    val evidenceAnchors: Set<SourceAnchor>,
)

data class IngestionResult(
    val sessionId: CaptureSessionId,
    val stage: IngestionStage,
    val artifacts: List<IngestedArtifact>,
    val candidates: List<MemoryCandidateDraft>,
)

interface IngestionCheckpointStore {
    fun load(sessionId: CaptureSessionId): IngestionCheckpoint?
    fun save(checkpoint: IngestionCheckpoint)
}

data class IngestionCheckpoint(
    val request: IngestionRequest,
    val extracted: List<ExtractedArtifact>,
    val stage: IngestionStage,
)

class InMemoryIngestionCheckpointStore : IngestionCheckpointStore {
    private val checkpoints = mutableMapOf<CaptureSessionId, IngestionCheckpoint>()
    override fun load(sessionId: CaptureSessionId): IngestionCheckpoint? = checkpoints[sessionId]
    override fun save(checkpoint: IngestionCheckpoint) { checkpoints[checkpoint.request.sessionId] = checkpoint }
}

class IngestionPipeline(
    private val extractors: List<ArtifactExtractor>,
    private val scanner: (String) -> SensitiveContentScan,
    private val policy: SensitiveContentPolicy = SensitiveContentPolicy(),
    private val checkpoints: IngestionCheckpointStore = InMemoryIngestionCheckpointStore(),
) {
    fun enqueue(sessionId: CaptureSessionId): IngestionResult = resume(sessionId)

    fun run(request: IngestionRequest): IngestionResult {
        val previous = checkpoints.load(request.sessionId)
        val extracted = previous?.extracted ?: request.artifacts.map(::extract).also {
            checkpoints.save(IngestionCheckpoint(request, it, IngestionStage.EXTRACTED))
        }
        return finish(request, extracted, request.sensitiveChoice)
    }

    fun resume(sessionId: CaptureSessionId, choice: SensitiveChoice? = null): IngestionResult {
        val checkpoint = requireNotNull(checkpoints.load(sessionId)) { "Unknown ingestion session: ${sessionId.value}" }
        return finish(checkpoint.request, checkpoint.extracted, choice ?: checkpoint.request.sensitiveChoice)
    }

    private fun extract(artifact: IngestionArtifact): ExtractedArtifact {
        val format = ArtifactFormat.detect(artifact.fileName, artifact.mediaType)
        val extractor = extractors.firstOrNull { it.supports(format) }
            ?: error("No extractor registered for ${format.name}")
        return extractor.extract(artifact, format)
    }

    private fun finish(
        request: IngestionRequest,
        extracted: List<ExtractedArtifact>,
        choice: SensitiveChoice?,
    ): IngestionResult {
        val scans = extracted.associateWith { scanner(it.text) }
        if (scans.values.any { it.hasSensitiveContent } && choice == null) {
            checkpoints.save(IngestionCheckpoint(request, extracted, IngestionStage.PHI_REVIEW_REQUIRED))
            return IngestionResult(request.sessionId, IngestionStage.PHI_REVIEW_REQUIRED, emptyList(), emptyList())
        }
        val ingested = extracted.map { item ->
            IngestedArtifact(item, policy.evaluate(scans.getValue(item), choice ?: SensitiveChoice.REDACT))
        }
        val durable = ingested.filter { it.sensitiveDecision.disposition != StorageDisposition.Rejected }
        val anchors = durable.flatMap { it.extracted.anchors }.toSet()
        val candidates = candidateFor(request.sessionId, durable, anchors)
        checkpoints.save(IngestionCheckpoint(request, extracted, IngestionStage.COMPLETE))
        return IngestionResult(request.sessionId, IngestionStage.COMPLETE, durable, candidates)
    }

    private fun candidateFor(
        sessionId: CaptureSessionId,
        artifacts: List<IngestedArtifact>,
        anchors: Set<SourceAnchor>,
    ): List<MemoryCandidateDraft> {
        if (artifacts.isEmpty() || anchors.isEmpty()) return emptyList()
        val text = artifacts.joinToString("\n") { it.extracted.text }.trim()
        if (text.isBlank()) return emptyList()
        val subject = if (text.contains("AbbaDox", ignoreCase = true)) "AbbaDox" else "Captured knowledge"
        return listOf(MemoryCandidateDraft(sessionId, subject, text, anchors))
    }
}
