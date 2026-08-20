package kairo.domain

import java.time.Instant
import java.util.Collections
import java.util.LinkedHashSet

@JvmInline
value class SourceId(val value: String) {
    init {
        require(value.isNotBlank()) { "SourceId must not be blank" }
    }
}

@JvmInline
value class SourceVariantId(val value: String) {
    init {
        require(value.isNotBlank()) { "SourceVariantId must not be blank" }
    }
}

enum class SourceOrigin {
    USER_CAPTURE,
    IMPORT,
    GENERATED,
}

enum class SourceType {
    PDF,
    IMAGE,
    SPREADSHEET,
    TEXT,
    CHAT_TRANSCRIPT,
    DOCUMENT,
    CSV,
}

enum class SourceClassification {
    PUBLIC,
    INTERNAL,
    CONFIDENTIAL,
    RESTRICTED,
}

enum class ExtractionStatus {
    NOT_REQUESTED,
    PENDING,
    EXTRACTED,
    FAILED,
}

sealed interface AnchorLocator {
    data class PdfPageBox(
        val page: Int,
        val left: Double,
        val top: Double,
        val right: Double,
        val bottom: Double,
    ) : AnchorLocator {
        init {
            require(page > 0) { "PDF page must be positive" }
            require(left.isFinite() && top.isFinite() && right.isFinite() && bottom.isFinite()) {
                "PDF box coordinates must be finite"
            }
            require(left >= 0.0 && top >= 0.0 && right > left && bottom > top) {
                "PDF box bounds must be ordered and non-negative"
            }
        }
    }

    data class ImageRegion(
        val left: Int,
        val top: Int,
        val width: Int,
        val height: Int,
    ) : AnchorLocator {
        init {
            require(left >= 0 && top >= 0 && width > 0 && height > 0) {
                "Image region bounds must be non-negative with positive size"
            }
        }
    }

    data class SheetRange(
        val sheet: String,
        val firstRow: Int,
        val firstColumn: Int,
        val lastRow: Int,
        val lastColumn: Int,
    ) : AnchorLocator {
        init {
            require(sheet.isNotBlank()) { "Sheet name must not be blank" }
            require(firstRow > 0 && firstColumn > 0 && lastRow >= firstRow && lastColumn >= firstColumn) {
                "Sheet range bounds must be positive and ordered"
            }
        }
    }

    data class TextSpan(
        val startOffset: Int,
        val endOffset: Int,
    ) : AnchorLocator {
        init {
            require(startOffset >= 0 && endOffset > startOffset) { "Text span bounds must be ordered" }
        }
    }

    data class ChatTurn(
        val conversationId: String,
        val turnNumber: Int,
        val startOffset: Int? = null,
        val endOffset: Int? = null,
    ) : AnchorLocator {
        init {
            require(conversationId.isNotBlank()) { "Chat conversationId must not be blank" }
            require(turnNumber > 0) { "Chat turnNumber must be positive" }
            require((startOffset == null) == (endOffset == null)) {
                "Chat offsets must be both present or both absent"
            }
            require(startOffset == null || (startOffset >= 0 && endOffset!! > startOffset)) {
                "Chat text bounds must be ordered"
            }
        }
    }
}

data class SourceAnchor(
    val sourceId: SourceId,
    val variantId: SourceVariantId,
    val locator: AnchorLocator,
)

class SourceVariant(
    val id: SourceVariantId,
    val sourceId: SourceId,
    val version: Int,
    val contentHash: String,
    val importedAt: Instant,
    val parentVariantId: SourceVariantId?,
    val extractionStatus: ExtractionStatus,
    anchors: Set<SourceAnchor>,
) {
    val anchors: Set<SourceAnchor> = contextSetSnapshot(anchors)

    init {
        require(version > 0) { "Source variant version must be positive" }
        require(contentHash.isNotBlank()) { "Source variant contentHash must not be blank" }
        require(this.anchors.all { it.sourceId == sourceId && it.variantId == id }) {
            "Source variant anchors must belong to this source variant"
        }
    }
}

class Source(
    val id: SourceId,
    val origin: SourceOrigin,
    val type: SourceType,
    val contentHash: String,
    val importedAt: Instant,
    val classification: SourceClassification,
    variants: List<SourceVariant>,
    anchors: Set<SourceAnchor>,
) {
    val variants: List<SourceVariant> = contextListSnapshot(variants)
    val anchors: Set<SourceAnchor> = contextSetSnapshot(anchors)

    init {
        require(contentHash.isNotBlank()) { "Source contentHash must not be blank" }
        require(this.variants.isNotEmpty()) { "Source must retain at least one variant" }
        require(this.variants.all { it.sourceId == id }) { "Source variants must belong to the source" }
        require(this.variants.map { it.id }.toSet().size == this.variants.size) {
            "Source variant identifiers must be unique"
        }
        require(this.variants.map { it.version }.toSet().size == this.variants.size) {
            "Source variant version numbers must be unique"
        }

        val variantsById = this.variants.associateBy { it.id }
        val rootVariants = this.variants.filter { it.parentVariantId == null }
        require(rootVariants.size == 1) { "Source must retain exactly one root variant" }
        val root = rootVariants.single()
        require(root.contentHash == contentHash && root.importedAt == importedAt) {
            "Source content hash and import time must identify its root variant"
        }
        this.variants
            .filter { it.parentVariantId != null }
            .forEach { variant ->
                val parent = variantsById[variant.parentVariantId]
                require(parent != null && parent.version < variant.version) {
                    "Source variant parent must resolve to an earlier variant"
                }
            }

        val retainedAnchors = this.variants.flatMap { it.anchors }.toSet()
        require(this.anchors == retainedAnchors) {
            "Source anchors must exactly equal the anchors retained by its variants"
        }
    }
}

internal fun <T> contextSetSnapshot(values: Set<T>): Set<T> =
    Collections.unmodifiableSet(LinkedHashSet(values))

internal fun <T> contextListSnapshot(values: List<T>): List<T> =
    Collections.unmodifiableList(ArrayList(values))
