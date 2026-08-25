package kairo.validation.e2e

import java.time.Instant
import kairo.domain.AnchorLocator
import kairo.domain.CaptureSessionId
import kairo.domain.SourceAnchor
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.ingestion.ArtifactExtractor
import kairo.ingestion.ArtifactFormat
import kairo.ingestion.ExtractedArtifact
import kairo.ingestion.IngestionArtifact
import kairo.ingestion.IngestionPipeline
import kairo.ingestion.IngestionRequest
import kairo.ingestion.IngestionStage
import kairo.security.SensitiveContentKind
import kairo.security.SensitiveContentMatch
import kairo.security.SensitiveContentScan
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class DefinitionOfDoneTest {

    @Test
    fun `capture session preserves four source types and routes synthetic PHI to local review`() {
        val pipeline = IngestionPipeline(
            extractors = listOf(ReleaseArtifactExtractor()),
            scanner = { text ->
                if (text.contains("SYNTHETIC_MRN_424242")) {
                    SensitiveContentScan(listOf(SensitiveContentMatch(SensitiveContentKind.MRN, 0, 20)))
                } else {
                    SensitiveContentScan(emptyList())
                }
            },
        )

        val safe = pipeline.run(
            IngestionRequest(
                sessionId = CaptureSessionId("release-safe-capture"),
                artifacts = listOf(
                    artifact("notes.docx", "AbbaDox worklist route is planned."),
                    artifact("workflow.pdf", "Merge RIS remains current."),
                    artifact("routing.png", "Interface routing evidence."),
                    artifact("mapping.xlsx", "Worklist mapping evidence."),
                ),
                capturedAt = Instant.parse("2026-08-25T12:00:00Z"),
            ),
        )

        assertEquals(IngestionStage.COMPLETE, safe.stage)
        assertEquals(4, safe.artifacts.size)
        assertTrue(safe.candidates.all { it.evidenceAnchors.isNotEmpty() })

        val sensitive = pipeline.run(
            IngestionRequest(
                sessionId = CaptureSessionId("release-sensitive-capture"),
                artifacts = listOf(artifact("synthetic.txt", "SYNTHETIC_MRN_424242")),
                capturedAt = Instant.parse("2026-08-25T12:00:00Z"),
            ),
        )

        assertEquals(IngestionStage.PHI_REVIEW_REQUIRED, sensitive.stage)
    }

    private fun artifact(name: String, text: String) =
        IngestionArtifact(
            sourceId = SourceId("release-$name"),
            variantId = SourceVariantId("release-$name-v1"),
            fileName = name,
            bytes = text.encodeToByteArray(),
        )
}

private class ReleaseArtifactExtractor : ArtifactExtractor {
    override fun supports(format: ArtifactFormat): Boolean = true

    override fun extract(artifact: IngestionArtifact, format: ArtifactFormat): ExtractedArtifact {
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
