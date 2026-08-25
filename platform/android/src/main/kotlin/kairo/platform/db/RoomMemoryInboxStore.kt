package kairo.platform.db

import java.time.Instant
import java.util.UUID
import kairo.application.MemoryCandidateId
import kairo.application.MemoryDecision
import kairo.application.MemoryDecisionType
import kairo.application.MemoryInboxStore
import kairo.application.PendingMemoryCandidate
import kairo.domain.AnchorLocator
import kairo.domain.CaptureSessionId
import kairo.domain.EvidenceState
import kairo.domain.KnowledgeScope
import kairo.domain.SourceAnchor
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.ingestion.MemoryCandidateDraft

class RoomMemoryInboxStore(
    database: KairoDatabase,
) : MemoryInboxStore {

    private val dao = database.memoryInboxDao()

    override fun pending(): List<PendingMemoryCandidate> =
        dao.candidates().map { row ->
            PendingMemoryCandidate(
                id = MemoryCandidateId(row.candidateId),
                draft = MemoryCandidateDraft(
                    sessionId = CaptureSessionId(row.sessionId),
                    subjectLabel = row.subjectLabel,
                    text = row.text,
                    proposedScope = KnowledgeScope.valueOf(row.proposedScope),
                    proposedState = EvidenceState.valueOf(row.proposedState),
                    evidenceAnchors = dao.anchors(row.candidateId)
                        .map(::anchorFromEntity)
                        .toSet(),
                ),
            )
        }

    override fun decisions(): List<MemoryDecision> =
        dao.decisions().map { row ->
            MemoryDecision(
                candidateId = MemoryCandidateId(row.candidateId),
                type = MemoryDecisionType.valueOf(row.decisionType),
                reviewer = row.reviewer,
                decidedAt = Instant.parse(row.decidedAt),
                originalText = row.originalText,
                approvedText = row.approvedText,
            )
        }

    override fun savePending(candidate: PendingMemoryCandidate) {
        dao.saveCandidate(
            MemoryCandidateEntity(
                candidateId = candidate.id.value,
                sessionId = candidate.draft.sessionId.value,
                subjectLabel = candidate.draft.subjectLabel,
                text = candidate.draft.text,
                proposedScope = candidate.draft.proposedScope.name,
                proposedState = candidate.draft.proposedState.name,
            ),
        )

        dao.deleteCandidateAnchors(candidate.id.value)

        dao.saveCandidateAnchors(
            candidate.draft.evidenceAnchors
                .toList()
                .mapIndexed { index, anchor ->
                    anchorToEntity(candidate.id, index, anchor)
                },
        )
    }

    override fun removePending(candidateId: MemoryCandidateId) {
        dao.deleteCandidateAnchors(candidateId.value)
        dao.deleteCandidate(candidateId.value)
    }

    override fun saveDecision(decision: MemoryDecision) {
        dao.saveDecision(
            MemoryDecisionEntity(
                decisionId = UUID.randomUUID().toString(),
                candidateId = decision.candidateId.value,
                decisionType = decision.type.name,
                reviewer = decision.reviewer,
                decidedAt = decision.decidedAt.toString(),
                originalText = decision.originalText,
                approvedText = decision.approvedText,
            ),
        )
    }

    private fun anchorToEntity(
        candidateId: MemoryCandidateId,
        ordinal: Int,
        anchor: SourceAnchor,
    ): MemoryCandidateAnchorEntity {
        val locator = anchor.locator

        return when (locator) {
            is AnchorLocator.PdfPageBox ->
                MemoryCandidateAnchorEntity(
                    candidateId = candidateId.value,
                    ordinal = ordinal,
                    sourceId = anchor.sourceId.value,
                    variantId = anchor.variantId.value,
                    locatorType = "PDF_PAGE_BOX",
                    page = locator.page,
                    left = locator.left,
                    top = locator.top,
                    right = locator.right,
                    bottom = locator.bottom,
                )

            is AnchorLocator.ImageRegion ->
                MemoryCandidateAnchorEntity(
                    candidateId = candidateId.value,
                    ordinal = ordinal,
                    sourceId = anchor.sourceId.value,
                    variantId = anchor.variantId.value,
                    locatorType = "IMAGE_REGION",
                    left = locator.left.toDouble(),
                    top = locator.top.toDouble(),
                    width = locator.width,
                    height = locator.height,
                )

            is AnchorLocator.SheetRange ->
                MemoryCandidateAnchorEntity(
                    candidateId = candidateId.value,
                    ordinal = ordinal,
                    sourceId = anchor.sourceId.value,
                    variantId = anchor.variantId.value,
                    locatorType = "SHEET_RANGE",
                    sheet = locator.sheet,
                    firstRow = locator.firstRow,
                    firstColumn = locator.firstColumn,
                    lastRow = locator.lastRow,
                    lastColumn = locator.lastColumn,
                )

            is AnchorLocator.TextSpan ->
                MemoryCandidateAnchorEntity(
                    candidateId = candidateId.value,
                    ordinal = ordinal,
                    sourceId = anchor.sourceId.value,
                    variantId = anchor.variantId.value,
                    locatorType = "TEXT_SPAN",
                    startOffset = locator.startOffset,
                    endOffset = locator.endOffset,
                )

            is AnchorLocator.ChatTurn ->
                MemoryCandidateAnchorEntity(
                    candidateId = candidateId.value,
                    ordinal = ordinal,
                    sourceId = anchor.sourceId.value,
                    variantId = anchor.variantId.value,
                    locatorType = "CHAT_TURN",
                    conversationId = locator.conversationId,
                    turnNumber = locator.turnNumber,
                    startOffset = locator.startOffset,
                    endOffset = locator.endOffset,
                )
        }
    }

    private fun anchorFromEntity(
        row: MemoryCandidateAnchorEntity,
    ): SourceAnchor {
        val locator = when (row.locatorType) {
            "PDF_PAGE_BOX" ->
                AnchorLocator.PdfPageBox(
                    page = requireNotNull(row.page),
                    left = requireNotNull(row.left),
                    top = requireNotNull(row.top),
                    right = requireNotNull(row.right),
                    bottom = requireNotNull(row.bottom),
                )

            "IMAGE_REGION" ->
                AnchorLocator.ImageRegion(
                    left = requireNotNull(row.left).toInt(),
                    top = requireNotNull(row.top).toInt(),
                    width = requireNotNull(row.width),
                    height = requireNotNull(row.height),
                )

            "SHEET_RANGE" ->
                AnchorLocator.SheetRange(
                    sheet = requireNotNull(row.sheet),
                    firstRow = requireNotNull(row.firstRow),
                    firstColumn = requireNotNull(row.firstColumn),
                    lastRow = requireNotNull(row.lastRow),
                    lastColumn = requireNotNull(row.lastColumn),
                )

            "TEXT_SPAN" ->
                AnchorLocator.TextSpan(
                    startOffset = requireNotNull(row.startOffset),
                    endOffset = requireNotNull(row.endOffset),
                )

            "CHAT_TURN" ->
                AnchorLocator.ChatTurn(
                    conversationId = requireNotNull(row.conversationId),
                    turnNumber = requireNotNull(row.turnNumber),
                    startOffset = row.startOffset,
                    endOffset = row.endOffset,
                )

            else -> error("Unknown memory anchor locator type: ${row.locatorType}")
        }

        return SourceAnchor(
            sourceId = SourceId(row.sourceId),
            variantId = SourceVariantId(row.variantId),
            locator = locator,
        )
    }
}
