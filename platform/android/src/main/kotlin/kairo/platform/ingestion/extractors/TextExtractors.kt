package kairo.platform.ingestion.extractors

import kairo.domain.AnchorLocator
import kairo.domain.SourceAnchor
import kairo.ingestion.ArtifactExtractor
import kairo.ingestion.ArtifactFormat
import kairo.ingestion.ExtractedArtifact
import kairo.ingestion.IngestionArtifact

/**
 * Small local extractors used for text-bearing artifacts. Rich layout and OCR engines
 * can be substituted behind [ArtifactExtractor] without changing pipeline contracts.
 */
abstract class LocalTextExtractor(private vararg val formats: ArtifactFormat) : ArtifactExtractor {
    override fun supports(format: ArtifactFormat): Boolean = format in formats

    override fun extract(artifact: IngestionArtifact, format: ArtifactFormat): ExtractedArtifact {
        val text = extractText(artifact.bytes).ifBlank { "[No extractable text in ${artifact.fileName}]" }
        return ExtractedArtifact(
            artifact = artifact,
            format = format,
            text = text,
            anchors = setOf(
                SourceAnchor(artifact.sourceId, artifact.variantId, AnchorLocator.TextSpan(0, text.length)),
            ),
        )
    }

    protected open fun extractText(bytes: ByteArray): String = bytes.decodeToString()
}

class PdfExtractor : LocalTextExtractor(ArtifactFormat.PDF) {
    override fun extractText(bytes: ByteArray): String = printableRuns(bytes)
}

class DocxExtractor : LocalTextExtractor(ArtifactFormat.DOCX) {
    override fun extractText(bytes: ByteArray): String = printableRuns(bytes)
}

class XlsxExtractor : LocalTextExtractor(ArtifactFormat.XLSX) {
    override fun extractText(bytes: ByteArray): String = printableRuns(bytes)
}

class CsvExtractor : LocalTextExtractor(ArtifactFormat.CSV)
class TextExtractor : LocalTextExtractor(ArtifactFormat.TEXT, ArtifactFormat.MARKDOWN, ArtifactFormat.PASTED_TEXT)
class ImageExtractor : LocalTextExtractor(ArtifactFormat.PNG, ArtifactFormat.JPEG) {
    override fun extractText(bytes: ByteArray): String = printableRuns(bytes)
}

fun defaultAndroidExtractors(): List<ArtifactExtractor> = listOf(
    PdfExtractor(), DocxExtractor(), XlsxExtractor(), CsvExtractor(), TextExtractor(), ImageExtractor(),
)

private fun printableRuns(bytes: ByteArray): String = bytes
    .decodeToString()
    .replace(Regex("[^\\x20-\\x7E\\n\\r\\t]+"), " ")
    .replace(Regex("\\s+"), " ")
    .trim()
