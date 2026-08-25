package kairo.platform.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "content_identities")
data class ContentIdentityEntity(
    @PrimaryKey
    @ColumnInfo(name = "content_hash")
    val contentHash: String,
)

@Entity(
    tableName = "sources",
    foreignKeys = [
        ForeignKey(
            entity = ContentIdentityEntity::class,
            parentColumns = ["content_hash"],
            childColumns = ["content_hash"],
            onDelete = ForeignKey.NO_ACTION,
            onUpdate = ForeignKey.NO_ACTION,
        ),
    ],
    indices = [
        Index(value = ["content_hash"]),
        Index(value = ["origin", "source_type"]),
    ],
)
data class SourceEntity(
    @PrimaryKey
    @ColumnInfo(name = "source_id")
    val sourceId: String,
    val origin: String,
    @ColumnInfo(name = "source_type")
    val sourceType: String,
    @ColumnInfo(name = "content_hash")
    val contentHash: String,
    @ColumnInfo(name = "imported_at")
    val importedAt: String,
    val classification: String,
    @ColumnInfo(name = "authority", defaultValue = "'UNSPECIFIED'")
    val authority: String,
)

@Entity(
    tableName = "source_variants",
    foreignKeys = [
        ForeignKey(
            entity = SourceEntity::class,
            parentColumns = ["source_id"],
            childColumns = ["source_id"],
            onDelete = ForeignKey.NO_ACTION,
            onUpdate = ForeignKey.NO_ACTION,
        ),
        ForeignKey(
            entity = ContentIdentityEntity::class,
            parentColumns = ["content_hash"],
            childColumns = ["content_hash"],
            onDelete = ForeignKey.NO_ACTION,
            onUpdate = ForeignKey.NO_ACTION,
        ),
        ForeignKey(
            entity = SourceVariantEntity::class,
            parentColumns = ["variant_id"],
            childColumns = ["parent_variant_id"],
            onDelete = ForeignKey.NO_ACTION,
            onUpdate = ForeignKey.NO_ACTION,
        ),
    ],
    indices = [
        Index(value = ["source_id", "version"], unique = true),
        Index(value = ["source_id", "variant_id"], unique = true),
        Index(value = ["source_id"]),
        Index(value = ["content_hash"]),
        Index(value = ["parent_variant_id"]),
    ],
)
data class SourceVariantEntity(
    @PrimaryKey
    @ColumnInfo(name = "variant_id")
    val variantId: String,
    @ColumnInfo(name = "source_id")
    val sourceId: String,
    val version: Int,
    @ColumnInfo(name = "content_hash")
    val contentHash: String,
    @ColumnInfo(name = "imported_at")
    val importedAt: String,
    @ColumnInfo(name = "parent_variant_id")
    val parentVariantId: String?,
    @ColumnInfo(name = "extraction_status")
    val extractionStatus: String,
)

@Entity(
    tableName = "source_anchors",
    primaryKeys = ["source_id", "variant_id", "anchor_key"],
    foreignKeys = [
        ForeignKey(
            entity = SourceVariantEntity::class,
            parentColumns = ["source_id", "variant_id"],
            childColumns = ["source_id", "variant_id"],
            onDelete = ForeignKey.NO_ACTION,
            onUpdate = ForeignKey.NO_ACTION,
        ),
    ],
    indices = [Index(value = ["variant_id"])],
)
data class SourceAnchorEntity(
    @ColumnInfo(name = "source_id")
    val sourceId: String,
    @ColumnInfo(name = "variant_id")
    val variantId: String,
    @ColumnInfo(name = "anchor_key")
    val anchorKey: String,
    @ColumnInfo(name = "locator_type")
    val locatorType: String,
    val page: Int? = null,
    val left: Double? = null,
    val top: Double? = null,
    val right: Double? = null,
    val bottom: Double? = null,
    val width: Int? = null,
    val height: Int? = null,
    val sheet: String? = null,
    @ColumnInfo(name = "first_row")
    val firstRow: Int? = null,
    @ColumnInfo(name = "first_column")
    val firstColumn: Int? = null,
    @ColumnInfo(name = "last_row")
    val lastRow: Int? = null,
    @ColumnInfo(name = "last_column")
    val lastColumn: Int? = null,
    @ColumnInfo(name = "start_offset")
    val startOffset: Int? = null,
    @ColumnInfo(name = "end_offset")
    val endOffset: Int? = null,
    @ColumnInfo(name = "conversation_id")
    val conversationId: String? = null,
    @ColumnInfo(name = "turn_number")
    val turnNumber: Int? = null,
)

@Entity(
    tableName = "fact_versions",
    foreignKeys = [
        ForeignKey(
            entity = FactVersionEntity::class,
            parentColumns = ["fact_id"],
            childColumns = ["supersedes_fact_id"],
            onDelete = ForeignKey.NO_ACTION,
            onUpdate = ForeignKey.NO_ACTION,
        ),
    ],
    indices = [
        Index(value = ["subject", "predicate", "object_type", "object_value"]),
        Index(value = ["scope"]),
        Index(value = ["evidence_state"]),
        Index(value = ["effective_from"]),
        Index(value = ["recorded_at"]),
        Index(value = ["lineage_id"]),
        Index(value = ["supersedes_fact_id"]),
    ],
)
data class FactVersionEntity(
    @PrimaryKey
    @ColumnInfo(name = "fact_id")
    val factId: String,
    @ColumnInfo(name = "lineage_id")
    val lineageId: String,
    val subject: String,
    val predicate: String,
    @ColumnInfo(name = "object_type")
    val objectType: String,
    @ColumnInfo(name = "object_value")
    val objectValue: String,
    val scope: String,
    @ColumnInfo(name = "evidence_state")
    val evidenceState: String,
    @ColumnInfo(name = "effective_from")
    val effectiveFrom: String?,
    @ColumnInfo(name = "effective_to")
    val effectiveTo: String?,
    @ColumnInfo(name = "recorded_at")
    val recordedAt: String,
    @ColumnInfo(name = "last_validated_at")
    val lastValidatedAt: String?,
    @ColumnInfo(name = "supersedes_fact_id")
    val supersedesFactId: String?,
)

@Entity(
    tableName = "fact_evidence",
    primaryKeys = ["fact_id", "ordinal"],
    foreignKeys = [
        ForeignKey(
            entity = FactVersionEntity::class,
            parentColumns = ["fact_id"],
            childColumns = ["fact_id"],
            onDelete = ForeignKey.NO_ACTION,
            onUpdate = ForeignKey.NO_ACTION,
        ),
        ForeignKey(
            entity = SourceEntity::class,
            parentColumns = ["source_id"],
            childColumns = ["source_id"],
            onDelete = ForeignKey.NO_ACTION,
            onUpdate = ForeignKey.NO_ACTION,
        ),
    ],
    indices = [Index(value = ["source_id"])],
)
data class FactEvidenceEntity(
    @ColumnInfo(name = "fact_id")
    val factId: String,
    val ordinal: Int,
    @ColumnInfo(name = "source_id")
    val sourceId: String,
    val anchor: String?,
    @ColumnInfo(name = "extraction_confidence")
    val extractionConfidence: Double?,
)

@Entity(tableName = "capture_sessions")
data class CaptureSessionEntity(
    @PrimaryKey
    @ColumnInfo(name = "capture_session_id")
    val captureSessionId: String,
    @ColumnInfo(name = "captured_at")
    val capturedAt: String,
    val title: String?,
)

@Entity(
    tableName = "capture_session_anchors",
    primaryKeys = ["capture_session_id", "source_id", "variant_id", "anchor_key"],
    foreignKeys = [
        ForeignKey(
            entity = CaptureSessionEntity::class,
            parentColumns = ["capture_session_id"],
            childColumns = ["capture_session_id"],
            onDelete = ForeignKey.NO_ACTION,
            onUpdate = ForeignKey.NO_ACTION,
        ),
        ForeignKey(
            entity = SourceVariantEntity::class,
            parentColumns = ["source_id", "variant_id"],
            childColumns = ["source_id", "variant_id"],
            onDelete = ForeignKey.NO_ACTION,
            onUpdate = ForeignKey.NO_ACTION,
        ),
    ],
    indices = [
        Index(value = ["source_id"]),
        Index(value = ["variant_id"]),
        Index(value = ["source_id", "variant_id"]),
    ],
)
data class CaptureSessionAnchorEntity(
    @ColumnInfo(name = "capture_session_id")
    val captureSessionId: String,
    @ColumnInfo(name = "source_id")
    val sourceId: String,
    @ColumnInfo(name = "variant_id")
    val variantId: String,
    @ColumnInfo(name = "anchor_key")
    val anchorKey: String,
    @ColumnInfo(name = "locator_type")
    val locatorType: String,
    val page: Int? = null,
    val left: Double? = null,
    val top: Double? = null,
    val right: Double? = null,
    val bottom: Double? = null,
    val width: Int? = null,
    val height: Int? = null,
    val sheet: String? = null,
    @ColumnInfo(name = "first_row")
    val firstRow: Int? = null,
    @ColumnInfo(name = "first_column")
    val firstColumn: Int? = null,
    @ColumnInfo(name = "last_row")
    val lastRow: Int? = null,
    @ColumnInfo(name = "last_column")
    val lastColumn: Int? = null,
    @ColumnInfo(name = "start_offset")
    val startOffset: Int? = null,
    @ColumnInfo(name = "end_offset")
    val endOffset: Int? = null,
    @ColumnInfo(name = "conversation_id")
    val conversationId: String? = null,
    @ColumnInfo(name = "turn_number")
    val turnNumber: Int? = null,
)

@Entity(
    tableName = "audit_events",
    indices = [
        Index(value = ["correlation_id"]),
        Index(value = ["target_type", "target_id"]),
        Index(value = ["occurred_at"]),
    ],
)
data class AuditEventEntity(
    @PrimaryKey
    @ColumnInfo(name = "audit_id")
    val auditId: String,
    val action: String,
    @ColumnInfo(name = "target_type")
    val targetType: String,
    @ColumnInfo(name = "target_id")
    val targetId: String,
    @ColumnInfo(name = "occurred_at")
    val occurredAt: String,
    @ColumnInfo(name = "correlation_id")
    val correlationId: String,
)

@Entity(tableName = "ingestion_checkpoints")
data class IngestionCheckpointEntity(
    @PrimaryKey @ColumnInfo(name = "session_id") val sessionId: String,
    @ColumnInfo(name = "captured_at") val capturedAt: String,
    val stage: String,
    @ColumnInfo(name = "sensitive_choice") val sensitiveChoice: String?,
)

@Entity(tableName = "ingestion_checkpoint_artifacts", primaryKeys = ["session_id", "variant_id"])
data class IngestionCheckpointArtifactEntity(
    @ColumnInfo(name = "session_id") val sessionId: String,
    @ColumnInfo(name = "source_id") val sourceId: String,
    @ColumnInfo(name = "variant_id") val variantId: String,
    @ColumnInfo(name = "file_name") val fileName: String,
    @ColumnInfo(name = "media_type") val mediaType: String?,
    @ColumnInfo(name = "payload_ref") val payloadRef: String,
    @ColumnInfo(name = "extraction_ref") val extractionRef: String?,
)

@Entity(tableName = "memory_candidates")
data class MemoryCandidateEntity(
    @PrimaryKey
    @ColumnInfo(name = "candidate_id")
    val candidateId: String,

    @ColumnInfo(name = "session_id")
    val sessionId: String,

    @ColumnInfo(name = "subject_label")
    val subjectLabel: String,

    val text: String,

    @ColumnInfo(name = "proposed_scope", defaultValue = "'MANA_PRODUCTION'")
    val proposedScope: String,

    @ColumnInfo(name = "proposed_state", defaultValue = "'OBSERVED'")
    val proposedState: String,

    @ColumnInfo(name = "proposed_predicate")
    val proposedPredicate: String?,

    @ColumnInfo(name = "proposed_object_value")
    val proposedObjectValue: String?,
)

@Entity(tableName = "memory_decisions")
data class MemoryDecisionEntity(
    @PrimaryKey
    @ColumnInfo(name = "decision_id")
    val decisionId: String,

    @ColumnInfo(name = "candidate_id")
    val candidateId: String,

    @ColumnInfo(name = "decision_type")
    val decisionType: String,

    val reviewer: String,

    @ColumnInfo(name = "decided_at")
    val decidedAt: String,

    @ColumnInfo(name = "original_text")
    val originalText: String?,

    @ColumnInfo(name = "approved_text")
    val approvedText: String?,
)

@Entity(
    tableName = "memory_candidate_anchors",
    primaryKeys = ["candidate_id", "ordinal"],
)
data class MemoryCandidateAnchorEntity(
    @ColumnInfo(name = "candidate_id")
    val candidateId: String,

    val ordinal: Int,

    @ColumnInfo(name = "source_id")
    val sourceId: String,

    @ColumnInfo(name = "variant_id")
    val variantId: String,

    @ColumnInfo(name = "locator_type")
    val locatorType: String,

    val page: Int? = null,
    val left: Double? = null,
    val top: Double? = null,
    val right: Double? = null,
    val bottom: Double? = null,
    val width: Int? = null,
    val height: Int? = null,
    val sheet: String? = null,

    @ColumnInfo(name = "first_row")
    val firstRow: Int? = null,

    @ColumnInfo(name = "first_column")
    val firstColumn: Int? = null,

    @ColumnInfo(name = "last_row")
    val lastRow: Int? = null,

    @ColumnInfo(name = "last_column")
    val lastColumn: Int? = null,

    @ColumnInfo(name = "start_offset")
    val startOffset: Int? = null,

    @ColumnInfo(name = "end_offset")
    val endOffset: Int? = null,

    @ColumnInfo(name = "conversation_id")
    val conversationId: String? = null,

    @ColumnInfo(name = "turn_number")
    val turnNumber: Int? = null,
)
