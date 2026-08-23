package kairo.android.app

import java.time.Instant
import java.util.UUID
import kairo.android.capture.KnowledgeCapture
import kairo.android.capture.KnowledgeCaptureRequest
import kairo.application.AuditEvent
import kairo.application.MemoryInboxService
import kairo.domain.AnchorLocator
import kairo.domain.CaptureSessionId
import kairo.domain.ExtractionStatus
import kairo.domain.Source
import kairo.domain.SourceAnchor
import kairo.domain.SourceClassification
import kairo.domain.SourceId
import kairo.domain.SourceOrigin
import kairo.domain.SourceType
import kairo.domain.SourceVariant
import kairo.domain.SourceVariantId
import kairo.ingestion.MemoryCandidateDraft
import kairo.platform.db.RoomKnowledgeRepository

class RoomKnowledgeCapture(
    private val repository: RoomKnowledgeRepository,
    private val memoryInbox: MemoryInboxService,
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

        val sourceText =
            buildString {
                append(request.subject)
                append('\n')
                append(request.predicate)
                append('\n')
                append(request.value)
            }

        val anchor =
            SourceAnchor(
                sourceId = sourceId,
                variantId = variantId,
                locator =
                    AnchorLocator.TextSpan(
                        startOffset = 0,
                        endOffset = sourceText.length,
                    ),
            )

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
                            anchors = setOf(anchor),
                        ),
                    ),
                anchors = setOf(anchor),
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

        memoryInbox.receive(
            MemoryCandidateDraft(
                sessionId =
                    CaptureSessionId(
                        "capture-session-$token",
                    ),
                subjectLabel = request.subject,
                text = request.value,
                evidenceAnchors = setOf(anchor),
            ),
        )
    }
}
