package kairo.ingestion

import java.time.Instant
import java.util.UUID
import kairo.domain.CaptureSessionId
import kairo.domain.EvidenceState
import kairo.domain.KnowledgeScope
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
    val proposedScope: KnowledgeScope = KnowledgeScope.MANA_PRODUCTION,
    val proposedState: EvidenceState = EvidenceState.OBSERVED,
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

@JvmInline
value class IngestionPayloadReference(val value: String) {
    init { require(value.isNotBlank()) { "Payload reference must not be blank" } }
}

data class IngestionArtifactCheckpoint(
    val sourceId: String,
    val variantId: String,
    val fileName: String,
    val mediaType: String?,
    val payload: IngestionPayloadReference,
)

data class IngestionExtractionCheckpoint(
    val artifact: IngestionArtifactCheckpoint,
    val payload: IngestionPayloadReference,
)

/** Opaque, session-scoped storage for payloads that must never enter checkpoint metadata. */
interface IngestionPayloadStore {
    fun storeArtifact(sessionId: CaptureSessionId, artifact: IngestionArtifact): IngestionPayloadReference
    fun loadArtifact(reference: IngestionPayloadReference): IngestionArtifact?
    fun storeExtraction(sessionId: CaptureSessionId, extracted: ExtractedArtifact): IngestionPayloadReference
    fun loadExtraction(reference: IngestionPayloadReference): ExtractedArtifact?
    fun deleteTemporary(sessionId: CaptureSessionId)
}

data class IngestionCheckpoint(
    val sessionId: CaptureSessionId,
    val capturedAt: Instant,
    val artifacts: List<IngestionArtifactCheckpoint>,
    val stage: IngestionStage,
    val extractions: List<IngestionExtractionCheckpoint> = emptyList(),
    val sensitiveChoice: SensitiveChoice? = null,
)

class InMemoryIngestionCheckpointStore : IngestionCheckpointStore {
    private val checkpoints = mutableMapOf<CaptureSessionId, IngestionCheckpoint>()
    override fun load(sessionId: CaptureSessionId): IngestionCheckpoint? = checkpoints[sessionId]
    override fun save(checkpoint: IngestionCheckpoint) { checkpoints[checkpoint.sessionId] = checkpoint }
}

class InMemoryIngestionPayloadStore : IngestionPayloadStore {
    private val artifacts = mutableMapOf<IngestionPayloadReference, IngestionArtifact>()
    private val extractions = mutableMapOf<IngestionPayloadReference, ExtractedArtifact>()
    private val sessions = mutableMapOf<CaptureSessionId, MutableSet<IngestionPayloadReference>>()
    override fun storeArtifact(sessionId: CaptureSessionId, artifact: IngestionArtifact) = store(sessionId, artifacts, artifact)
    override fun loadArtifact(reference: IngestionPayloadReference): IngestionArtifact? = artifacts[reference]
    override fun storeExtraction(sessionId: CaptureSessionId, extracted: ExtractedArtifact) = store(sessionId, extractions, extracted)
    override fun loadExtraction(reference: IngestionPayloadReference): ExtractedArtifact? = extractions[reference]
    override fun deleteTemporary(sessionId: CaptureSessionId) {
        sessions.remove(sessionId)?.forEach { artifacts.remove(it); extractions.remove(it) }
    }
    private fun <T> store(sessionId: CaptureSessionId, target: MutableMap<IngestionPayloadReference, T>, value: T): IngestionPayloadReference {
        val ref = IngestionPayloadReference(UUID.randomUUID().toString())
        target[ref] = value; sessions.getOrPut(sessionId) { linkedSetOf() }.add(ref); return ref
    }
}

class IngestionPipeline(
    private val extractors: List<ArtifactExtractor>,
    private val scanner: (String) -> SensitiveContentScan,
    private val policy: SensitiveContentPolicy = SensitiveContentPolicy(),
    private val checkpoints: IngestionCheckpointStore = InMemoryIngestionCheckpointStore(),
    private val payloads: IngestionPayloadStore = InMemoryIngestionPayloadStore(),
) {
    fun enqueue(sessionId: CaptureSessionId): IngestionResult = resume(sessionId)

    fun run(request: IngestionRequest): IngestionResult {
        val checkpoint = checkpoints.load(request.sessionId) ?: checkpointFor(request).also(checkpoints::save)
        if (checkpoint.stage == IngestionStage.COMPLETE) return completedResult(checkpoint.sessionId)
        val extracted = extractedFor(checkpoint)
        val persisted = requireNotNull(checkpoints.load(request.sessionId))
        return finish(persisted, extracted, request.sensitiveChoice ?: persisted.sensitiveChoice)
    }

    fun resume(sessionId: CaptureSessionId, choice: SensitiveChoice? = null): IngestionResult {
        val checkpoint = requireNotNull(checkpoints.load(sessionId)) { "Unknown ingestion session: ${sessionId.value}" }
        if (checkpoint.stage == IngestionStage.COMPLETE) return completedResult(sessionId)
        val extracted = extractedFor(checkpoint)
        val persisted = requireNotNull(checkpoints.load(sessionId))
        return finish(persisted, extracted, choice ?: persisted.sensitiveChoice)
    }

    private fun extract(artifact: IngestionArtifact): ExtractedArtifact {
        val format = ArtifactFormat.detect(artifact.fileName, artifact.mediaType)
        val extractor = extractors.firstOrNull { it.supports(format) }
            ?: error("No extractor registered for ${format.name}")
        return extractor.extract(artifact, format)
    }

    private fun completedResult(sessionId: CaptureSessionId): IngestionResult {
        payloads.deleteTemporary(sessionId)
        return IngestionResult(sessionId, IngestionStage.COMPLETE, emptyList(), emptyList())
    }

    private fun checkpointFor(request: IngestionRequest): IngestionCheckpoint = IngestionCheckpoint(
        sessionId = request.sessionId,
        capturedAt = request.capturedAt,
        artifacts = request.artifacts.map { artifact ->
            IngestionArtifactCheckpoint(artifact.sourceId.value, artifact.variantId.value, artifact.fileName, artifact.mediaType, payloads.storeArtifact(request.sessionId, artifact))
        },
        stage = IngestionStage.IMPORTED,
        sensitiveChoice = request.sensitiveChoice,
    )

    private fun extractedFor(checkpoint: IngestionCheckpoint): List<ExtractedArtifact> {
        if (checkpoint.extractions.isNotEmpty()) return checkpoint.extractions.map {
            requireNotNull(payloads.loadExtraction(it.payload)) { "Missing temporary extraction payload: ${it.payload.value}" }
        }
        val extracted = checkpoint.artifacts.map { descriptor ->
            extract(requireNotNull(payloads.loadArtifact(descriptor.payload)) { "Missing temporary artifact payload: ${descriptor.payload.value}" })
        }
        val saved = checkpoint.copy(
            extractions = extracted.zip(checkpoint.artifacts).map { (item, artifact) -> IngestionExtractionCheckpoint(artifact, payloads.storeExtraction(checkpoint.sessionId, item)) },
            stage = IngestionStage.EXTRACTED,
        )
        checkpoints.save(saved)
        return extracted
    }

    private fun finish(
        checkpoint: IngestionCheckpoint,
        extracted: List<ExtractedArtifact>,
        choice: SensitiveChoice?,
    ): IngestionResult {
        val scans = extracted.associateWith { scanner(it.text) }
        if (scans.values.any { it.hasSensitiveContent } && choice == null) {
            checkpoints.save(checkpoint.copy(stage = IngestionStage.PHI_REVIEW_REQUIRED, sensitiveChoice = choice))
            return IngestionResult(checkpoint.sessionId, IngestionStage.PHI_REVIEW_REQUIRED, emptyList(), emptyList())
        }
        val ingested = extracted.map { item ->
            IngestedArtifact(item, policy.evaluate(scans.getValue(item), choice ?: SensitiveChoice.REDACT))
        }
        val durable = ingested.filter { it.sensitiveDecision.disposition != StorageDisposition.Rejected }
        val anchors = durable.flatMap { it.extracted.anchors }.toSet()
        val candidates = candidateFor(checkpoint.sessionId, durable, anchors)
        checkpoints.save(checkpoint.copy(stage = IngestionStage.COMPLETE, sensitiveChoice = choice))
        payloads.deleteTemporary(checkpoint.sessionId)
        return IngestionResult(checkpoint.sessionId, IngestionStage.COMPLETE, durable, candidates)
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
