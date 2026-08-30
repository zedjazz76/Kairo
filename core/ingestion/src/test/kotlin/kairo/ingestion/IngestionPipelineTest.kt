package kairo.ingestion

import java.time.Instant
import kairo.domain.AnchorLocator
import kairo.domain.CaptureSessionId
import kairo.domain.SourceAnchor
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.security.SensitiveContentKind
import kairo.security.SensitiveContentMatch
import kairo.security.SensitiveContentScan
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class IngestionPipelineTest {
    private val sessionId = CaptureSessionId("abbadox-cutover")

    @Test
    fun `completed durable artifacts are published once for evidence capture`() {
        var completion: IngestionResult? = null
        var completionCalls = 0
        val pipeline = IngestionPipeline(
            extractors = listOf(PlainTextArtifactExtractor()),
            scanner = { SensitiveContentScan(emptyList()) },
            onCompleted = { result ->
                completion = result
                completionCalls += 1
            },
        )
        val request = IngestionRequest(
            sessionId = sessionId,
            artifacts = listOf(artifact("workflow.txt", "PACS forwards studies to MagView.")),
            capturedAt = Instant.parse("2026-08-20T10:00:00Z"),
        )

        pipeline.run(request)
        pipeline.resume(sessionId)

        assertEquals(1, completionCalls)
        assertEquals("PACS forwards studies to MagView.", completion?.artifacts?.single()?.extracted?.text)
    }

    @Test
    fun `batch analysis preserves cross artifact context and source anchors`() {
        val pipeline = IngestionPipeline(
            extractors = listOf(PlainTextArtifactExtractor()),
            scanner = { SensitiveContentScan(emptyList()) },
        )
        val result = pipeline.run(
            IngestionRequest(
                sessionId = sessionId,
                artifacts = listOf(
                    artifact("notes.docx", "AbbaDox will distribute reports."),
                    artifact("workflow.pdf", "AbbaDox cutover is September 1."),
                    artifact("screen.png", "AbbaDox workstation review."),
                    artifact("interfaces.xlsx", "AbbaDox interface testing."),
                ),
                capturedAt = Instant.parse("2026-08-20T10:00:00Z"),
            ),
        )

        assertEquals(IngestionStage.COMPLETE, result.stage)
        assertEquals(4, result.artifacts.size)
        assertTrue(result.candidates.any { it.subjectLabel == "AbbaDox" })
        assertTrue(result.candidates.all { it.evidenceAnchors.isNotEmpty() })
        assertTrue(result.candidates.single().evidenceAnchors.map { it.sourceId }.toSet().size == 4)
    }

    @Test
    fun `pipeline resumes at phi review without repeating completed extraction`() {
        var extractions = 0
        val pipeline = IngestionPipeline(
            extractors = listOf(PlainTextArtifactExtractor { extractions += 1 }),
            scanner = {
                SensitiveContentScan(listOf(SensitiveContentMatch(SensitiveContentKind.MRN, 0, 11)))
            },
        )
        val request = IngestionRequest(
            sessionId = sessionId,
            artifacts = listOf(artifact("patient.txt", "MRN: 123456")),
            capturedAt = Instant.parse("2026-08-20T10:00:00Z"),
        )

        val paused = pipeline.run(request)
        val resumed = pipeline.resume(sessionId, SensitiveChoice.TEMPORARY_USE)

        assertEquals(IngestionStage.PHI_REVIEW_REQUIRED, paused.stage)
        assertEquals(IngestionStage.COMPLETE, resumed.stage)
        assertEquals(1, extractions)
        assertTrue(resumed.artifacts.single().temporaryOnly)
    }

    @Test
    fun `completed checkpoint resumes idempotently after temporary payload cleanup`() {
        var extractions = 0
        val payloads = RecordingPayloadStore()
        val pipeline = IngestionPipeline(
            extractors = listOf(PlainTextArtifactExtractor { extractions += 1 }),
            scanner = { SensitiveContentScan(emptyList()) },
            payloads = payloads,
        )
        val request = IngestionRequest(
            sessionId = sessionId,
            artifacts = listOf(artifact("status.txt", "PACS ONLINE")),
            capturedAt = Instant.parse("2026-08-20T10:00:00Z"),
        )

        assertEquals(IngestionStage.COMPLETE, pipeline.run(request).stage)

        assertEquals(IngestionStage.COMPLETE, pipeline.resume(sessionId).stage)
        assertEquals(1, extractions)
        assertEquals(2, payloads.deleteCalls)
    }

    private fun artifact(name: String, text: String) = IngestionArtifact(
        sourceId = SourceId(name),
        variantId = SourceVariantId("$name-v1"),
        fileName = name,
        bytes = text.encodeToByteArray(),
    )
}

private class RecordingPayloadStore : IngestionPayloadStore {
    private val delegate = InMemoryIngestionPayloadStore()
    var deleteCalls = 0
        private set

    override fun storeArtifact(sessionId: CaptureSessionId, artifact: IngestionArtifact) =
        delegate.storeArtifact(sessionId, artifact)
    override fun loadArtifact(reference: IngestionPayloadReference) = delegate.loadArtifact(reference)
    override fun storeExtraction(sessionId: CaptureSessionId, extracted: ExtractedArtifact) =
        delegate.storeExtraction(sessionId, extracted)
    override fun loadExtraction(reference: IngestionPayloadReference) = delegate.loadExtraction(reference)
    override fun deleteTemporary(sessionId: CaptureSessionId) {
        deleteCalls += 1
        delegate.deleteTemporary(sessionId)
    }
}

private class PlainTextArtifactExtractor(
    private val onExtract: () -> Unit = {},
) : ArtifactExtractor {
    override fun supports(format: ArtifactFormat) = true

    override fun extract(artifact: IngestionArtifact, format: ArtifactFormat): ExtractedArtifact {
        onExtract()
        val text = artifact.bytes.decodeToString()
        return ExtractedArtifact(
            artifact = artifact,
            format = format,
            text = text,
            anchors = setOf(
                SourceAnchor(artifact.sourceId, artifact.variantId, AnchorLocator.TextSpan(0, text.length)),
            ),
        )
    }
}
