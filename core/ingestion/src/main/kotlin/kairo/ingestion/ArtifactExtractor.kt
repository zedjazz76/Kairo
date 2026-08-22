package kairo.ingestion

import kairo.domain.SourceAnchor
import kairo.domain.SourceId
import kairo.domain.SourceVariantId

enum class ArtifactFormat {
    PDF, DOCX, XLSX, CSV, TEXT, MARKDOWN, PNG, JPEG, PASTED_TEXT, UNSUPPORTED;

    companion object {
        const val PASTED_TEXT_MEDIA_TYPE = "application/vnd.kairo.pasted-text"

        fun detect(fileName: String, mediaType: String? = null): ArtifactFormat = when {
            mediaType.equals(PASTED_TEXT_MEDIA_TYPE, ignoreCase = true) -> PASTED_TEXT
            mediaType.equals("text/plain", ignoreCase = true) -> TEXT
            mediaType.equals("text/markdown", ignoreCase = true) -> MARKDOWN
            fileName.endsWith(".pdf", ignoreCase = true) -> PDF
            fileName.endsWith(".docx", ignoreCase = true) -> DOCX
            fileName.endsWith(".xlsx", ignoreCase = true) -> XLSX
            fileName.endsWith(".csv", ignoreCase = true) -> CSV
            fileName.endsWith(".md", ignoreCase = true) -> MARKDOWN
            fileName.endsWith(".txt", ignoreCase = true) -> TEXT
            fileName.endsWith(".png", ignoreCase = true) -> PNG
            fileName.endsWith(".jpg", ignoreCase = true) || fileName.endsWith(".jpeg", ignoreCase = true) -> JPEG
            else -> UNSUPPORTED
        }
    }
}

class IngestionArtifact(
    val sourceId: SourceId,
    val variantId: SourceVariantId,
    val fileName: String,
    bytes: ByteArray,
    val mediaType: String? = null,
) {
    val bytes: ByteArray = bytes.copyOf()

    init {
        require(fileName.isNotBlank()) { "Artifact fileName must not be blank" }
        require(this.bytes.isNotEmpty()) { "Artifact bytes must not be empty" }
    }
}

data class ExtractedArtifact(
    val artifact: IngestionArtifact,
    val format: ArtifactFormat,
    val text: String,
    val anchors: Set<SourceAnchor>,
) {
    init {
        require(anchors.isNotEmpty()) { "Extracted artifact must retain source anchors" }
        require(anchors.all { it.sourceId == artifact.sourceId && it.variantId == artifact.variantId }) {
            "Extracted artifact anchors must belong to its source variant"
        }
    }
}

interface ArtifactExtractor {
    fun supports(format: ArtifactFormat): Boolean
    fun extract(artifact: IngestionArtifact, format: ArtifactFormat): ExtractedArtifact
}
