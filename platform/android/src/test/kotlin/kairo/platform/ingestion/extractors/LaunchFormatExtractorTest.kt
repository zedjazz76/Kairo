package kairo.platform.ingestion.extractors

import kairo.domain.AnchorLocator
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.ingestion.ArtifactFormat
import kairo.ingestion.IngestionArtifact
import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class LaunchFormatExtractorTest {
    @Test
    fun `csv text markdown and pasted text retain local text and provenance`() {
        val cases = listOf(
            Triple("systems.csv", "text/plain", ArtifactFormat.CSV),
            Triple("notes.txt", null, ArtifactFormat.TEXT),
            Triple("runbook.md", "text/plain", ArtifactFormat.MARKDOWN),
            Triple("pasted-text", ArtifactFormat.PASTED_TEXT_MEDIA_TYPE, ArtifactFormat.PASTED_TEXT),
        )

        cases.forEachIndexed { index, (fileName, mediaType, expectedFormat) ->
            val artifact = artifact(index, fileName, mediaType, "PACS ONLINE")
            val detected = ArtifactFormat.detect(fileName, mediaType)
            val extractor = defaultAndroidExtractors().single { it.supports(detected) }

            val extracted = extractor.extract(artifact, detected)

            assertEquals(expectedFormat, detected)
            assertEquals("PACS ONLINE", extracted.text)
            assertTrue(extracted.anchors.isNotEmpty())
        }
    }

    @Test
    fun `jpeg routes through image OCR with region provenance`() {
        val artifact = artifact(5, "screenshot.jpeg", "image/jpeg", "jpeg-fixture")
        val extractor = ImageExtractor {
            OcrResult("PACS ONLINE", 640, 480, listOf(OcrRegion("PACS ONLINE", 10, 20, 200, 40)))
        }

        val extracted = extractor.extract(artifact, ArtifactFormat.detect(artifact.fileName, artifact.mediaType))

        assertEquals(ArtifactFormat.JPEG, extracted.format)
        assertEquals("PACS ONLINE", extracted.text)
        assertIs<AnchorLocator.ImageRegion>(extracted.anchors.single().locator)
    }

    @Test
    fun `csv retains used row and column range`() {
        val artifact = artifact(6, "systems.csv", "text/csv", "System,Status\nMerge PACS,Production")

        val extracted = CsvExtractor().extract(artifact, ArtifactFormat.CSV)

        assertEquals(
            AnchorLocator.SheetRange("systems.csv", 1, 1, 2, 2),
            extracted.anchors.single().locator,
        )
    }

    private fun artifact(index: Int, name: String, mediaType: String?, text: String) = IngestionArtifact(
        sourceId = SourceId("launch-source-$index"),
        variantId = SourceVariantId("launch-variant-$index"),
        fileName = name,
        bytes = text.encodeToByteArray(),
        mediaType = mediaType,
    )
}
