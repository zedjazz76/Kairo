package kairo.android.app

import java.time.Instant
import java.util.UUID
import kairo.android.capture.KnowledgeCapture
import kairo.android.capture.KnowledgeCaptureRequest
import kairo.application.AuditEvent
import kairo.domain.EntityId
import kairo.domain.EvidenceRef
import kairo.domain.EvidenceState
import kairo.domain.ExtractionStatus
import kairo.domain.FactId
import kairo.domain.FactLineageId
import kairo.domain.FactObject
import kairo.domain.FactVersion
import kairo.domain.KnowledgeScope
import kairo.domain.Source
import kairo.domain.SourceClassification
import kairo.domain.SourceId
import kairo.domain.SourceOrigin
import kairo.domain.SourceType
import kairo.domain.SourceVariant
import kairo.domain.SourceVariantId
import kairo.platform.db.RoomKnowledgeRepository

class RoomKnowledgeCapture(
    private val repository: RoomKnowledgeRepository,
) : KnowledgeCapture {

    override suspend fun save(
        request: KnowledgeCaptureRequest,
    ) {
        val now = Instant.now()
        val token = UUID.randomUUID().toString()

        val sourceId =
            SourceId("capture-source-$token")

        val variantId =
            SourceVariantId("capture-variant-$token")

        val factId =
            FactId("capture-fact-$token")

        val source =
            Source(
                id = sourceId,
                origin = SourceOrigin.USER_CAPTURE,
                type = SourceType.TEXT,
                contentHash = "capture:$token",
                importedAt = now,
                classification =
                    SourceClassification.INTERNAL,
                variants =
                    listOf(
                        SourceVariant(
                            id = variantId,
                            sourceId = sourceId,
                            version = 1,
                            contentHash = "capture:$token",
                            importedAt = now,
                            parentVariantId = null,
                            extractionStatus =
                                ExtractionStatus.EXTRACTED,
                            anchors = emptySet(),
                        ),
                    ),
                anchors = emptySet(),
            )

        repository.saveSource(
            source = source,
            audit =
                AuditEvent(
                    id = "audit-source-$token",
                    action = "SAVE_SOURCE",
                    targetType = "SOURCE",
                    targetId = sourceId.value,
                    occurredAt = now,
                    correlationId = token,
                ),
        )

        val fact =
            FactVersion(
                id = factId,
                lineageId =
                    FactLineageId(
                        "capture-lineage-$token",
                    ),
                subject =
                    EntityId(
                        request.subject,
                    ),
                predicate =
                    request.predicate,
                objectValue =
                    FactObject.Literal(
                        request.value,
                    ),
                scope =
                    KnowledgeScope.MANA_PRODUCTION,
                state =
                    EvidenceState.CONFIRMED,
                effectiveFrom = null,
                effectiveTo = null,
                recordedAt = now,
                lastValidatedAt = null,
                evidence =
                    setOf(
                        EvidenceRef(
                            sourceId =
                                sourceId.value,
                            anchor =
                                "typed-capture",
                            extractionConfidence =
                                1.0,
                        ),
                    ),
            )

        repository.appendFactVersion(
            fact = fact,
            audit =
                AuditEvent(
                    id = "audit-fact-$token",
                    action =
                        "APPEND_FACT_VERSION",
                    targetType =
                        "FACT_VERSION",
                    targetId =
                        factId.value,
                    occurredAt = now,
                    correlationId = token,
                ),
        )
    }
}
