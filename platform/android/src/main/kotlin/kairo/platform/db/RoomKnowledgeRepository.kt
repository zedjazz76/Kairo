package kairo.platform.db

import androidx.room.withTransaction
import java.time.Instant
import java.util.ArrayList
import java.util.Collections
import kairo.application.AuditEvent
import kairo.application.FactQuery
import kairo.application.KnowledgeRepository
import kairo.domain.AnchorLocator
import kairo.domain.CaptureSession
import kairo.domain.CaptureSessionId
import kairo.domain.CurrentBestUnderstanding
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
import kairo.domain.SourceAnchor
import kairo.domain.SourceAuthority
import kairo.domain.SourceClassification
import kairo.domain.SourceId
import kairo.domain.SourceOrigin
import kairo.domain.SourceType
import kairo.domain.SourceVariant
import kairo.domain.SourceVariantId

class RoomKnowledgeRepository(
    private val database: KairoDatabase,
) : KnowledgeRepository {
    private val dao: KnowledgeDao = database.knowledgeDao()

    override suspend fun appendFactVersion(fact: FactVersion, audit: AuditEvent) {
        require(audit.targetId == fact.id.value) { "Fact audit target must match the appended fact" }
        database.withTransaction {
            fact.supersedes?.let { predecessorId ->
                val predecessor = requireNotNull(dao.fact(predecessorId.value)) {
                    "Superseded fact ${predecessorId.value} does not exist"
                }
                require(predecessor.lineageId == fact.lineageId.value) {
                    "A successor must preserve its predecessor lineage"
                }
            }
            dao.insertFact(fact.toEntity())
            dao.insertFactEvidence(
                fact.evidence.mapIndexed { ordinal, evidence -> evidence.toEntity(fact.id, ordinal) },
            )
            dao.insertAuditEvent(audit.toEntity())
        }
    }

    override suspend fun currentUnderstanding(query: FactQuery): List<FactVersion> {
        val versions = database.withTransaction {
            dao.factsForProjection().map { it.toDomain() }
        }
        return immutableList(
            CurrentBestUnderstanding.project(versions, query.at).current.filter { fact ->
                (query.subject == null || fact.subject == query.subject) &&
                    (query.predicate == null || fact.predicate == query.predicate)
            },
        )
    }

    override suspend fun history(lineageId: FactLineageId): List<FactVersion> = database.withTransaction {
        immutableList(
            dao.history(lineageId.value)
                .map { it.toDomain() }
                .sortedWith(compareBy<FactVersion> { it.recordedAt }.thenBy { it.id.value }),
        )
    }

    override suspend fun saveSource(source: Source, audit: AuditEvent) {
        require(audit.targetId == source.id.value) { "Source audit target must match the saved source" }
        database.withTransaction {
            dao.insertContentIdentities(
                source.variants
                    .map { ContentIdentityEntity(it.contentHash) }
                    .distinctBy { it.contentHash },
            )
            dao.insertSource(source.toEntity())
            dao.insertSourceVariants(source.variants.sortedBy { it.version }.map { it.toEntity() })
            dao.insertSourceAnchors(source.anchors.map { it.toSourceAnchorEntity() })
            dao.insertAuditEvent(audit.toEntity())
        }
    }

    override suspend fun saveCaptureSession(session: CaptureSession, audit: AuditEvent) {
        require(audit.targetId == session.id.value) { "Capture Session audit target must match the saved session" }
        database.withTransaction {
            dao.insertCaptureSession(session.toEntity())
            dao.insertCaptureSessionAnchors(session.anchors.map { it.toCaptureSessionAnchorEntity(session.id) })
            dao.insertAuditEvent(audit.toEntity())
        }
    }

    suspend fun source(id: SourceId): Source? = database.withTransaction {
        val source = dao.source(id.value) ?: return@withTransaction null
        val anchors = dao.sourceAnchors(id.value).map { it.toDomain() }
        val anchorsByVariant = anchors.groupBy { it.variantId }
        val variants = dao.sourceVariants(id.value).map { variant ->
            variant.toDomain(anchorsByVariant[SourceVariantId(variant.variantId)].orEmpty().toSet())
        }
        source.toDomain(variants, anchors.toSet())
    }

    suspend fun captureSession(id: CaptureSessionId): CaptureSession? = database.withTransaction {
        val session = dao.captureSession(id.value) ?: return@withTransaction null
        session.toDomain(dao.captureSessionAnchors(id.value).map { it.toDomain() }.toSet())
    }

    private suspend fun FactVersionEntity.toDomain(): FactVersion = FactVersion(
        id = FactId(factId),
        lineageId = FactLineageId(lineageId),
        subject = EntityId(subject),
        predicate = predicate,
        objectValue = when (objectType) {
            "ENTITY" -> FactObject.Entity(EntityId(objectValue))
            "LITERAL" -> FactObject.Literal(objectValue)
            else -> error("Unknown persisted fact object type: $objectType")
        },
        scope = KnowledgeScope.valueOf(scope),
        state = EvidenceState.valueOf(evidenceState),
        effectiveFrom = effectiveFrom?.let(Instant::parse),
        effectiveTo = effectiveTo?.let(Instant::parse),
        recordedAt = Instant.parse(recordedAt),
        lastValidatedAt = lastValidatedAt?.let(Instant::parse),
        evidence = dao.evidenceForFact(factId).map { it.toDomain() }.toSet(),
        supersedes = supersedesFactId?.let(::FactId),
    )
}

private fun FactVersion.toEntity(): FactVersionEntity {
    val (objectType, persistedValue) = when (val value = objectValue) {
        is FactObject.Entity -> "ENTITY" to value.value.value
        is FactObject.Literal -> "LITERAL" to value.value
    }
    return FactVersionEntity(
        factId = id.value,
        lineageId = lineageId.value,
        subject = subject.value,
        predicate = predicate,
        objectType = objectType,
        objectValue = persistedValue,
        scope = scope.name,
        evidenceState = state.name,
        effectiveFrom = effectiveFrom?.toString(),
        effectiveTo = effectiveTo?.toString(),
        recordedAt = recordedAt.toString(),
        lastValidatedAt = lastValidatedAt?.toString(),
        supersedesFactId = supersedes?.value,
    )
}

private fun EvidenceRef.toEntity(factId: FactId, ordinal: Int): FactEvidenceEntity = FactEvidenceEntity(
    factId = factId.value,
    ordinal = ordinal,
    sourceId = sourceId,
    anchor = anchor,
    extractionConfidence = extractionConfidence,
)

private fun FactEvidenceEntity.toDomain(): EvidenceRef = EvidenceRef(sourceId, anchor, extractionConfidence)

private fun AuditEvent.toEntity(): AuditEventEntity = AuditEventEntity(
    auditId = id,
    action = action,
    targetType = targetType,
    targetId = targetId,
    occurredAt = occurredAt.toString(),
    correlationId = correlationId,
)

private fun Source.toEntity(): SourceEntity = SourceEntity(
    sourceId = id.value,
    origin = origin.name,
    sourceType = type.name,
    contentHash = contentHash,
    importedAt = importedAt.toString(),
    classification = classification.name,
    authority = authority.name,
)

private fun SourceEntity.toDomain(
    variants: List<SourceVariant>,
    anchors: Set<SourceAnchor>,
): Source = Source(
    id = SourceId(sourceId),
    origin = SourceOrigin.valueOf(origin),
    type = SourceType.valueOf(sourceType),
    contentHash = contentHash,
    importedAt = Instant.parse(importedAt),
    classification = SourceClassification.valueOf(classification),
    variants = variants,
    anchors = anchors,
    authority = SourceAuthority.valueOf(authority),
)

private fun SourceVariant.toEntity(): SourceVariantEntity = SourceVariantEntity(
    variantId = id.value,
    sourceId = sourceId.value,
    version = version,
    contentHash = contentHash,
    importedAt = importedAt.toString(),
    parentVariantId = parentVariantId?.value,
    extractionStatus = extractionStatus.name,
)

private fun SourceVariantEntity.toDomain(anchors: Set<SourceAnchor>): SourceVariant = SourceVariant(
    id = SourceVariantId(variantId),
    sourceId = SourceId(sourceId),
    version = version,
    contentHash = contentHash,
    importedAt = Instant.parse(importedAt),
    parentVariantId = parentVariantId?.let(::SourceVariantId),
    extractionStatus = ExtractionStatus.valueOf(extractionStatus),
    anchors = anchors,
)

private fun CaptureSession.toEntity(): CaptureSessionEntity = CaptureSessionEntity(
    captureSessionId = id.value,
    capturedAt = capturedAt.toString(),
    title = title,
)

private fun CaptureSessionEntity.toDomain(anchors: Set<SourceAnchor>): CaptureSession = CaptureSession(
    id = CaptureSessionId(captureSessionId),
    capturedAt = Instant.parse(capturedAt),
    anchors = anchors,
    title = title,
)

private data class LocatorColumns(
    val type: String,
    val key: String,
    val page: Int? = null,
    val left: Double? = null,
    val top: Double? = null,
    val right: Double? = null,
    val bottom: Double? = null,
    val width: Int? = null,
    val height: Int? = null,
    val sheet: String? = null,
    val firstRow: Int? = null,
    val firstColumn: Int? = null,
    val lastRow: Int? = null,
    val lastColumn: Int? = null,
    val startOffset: Int? = null,
    val endOffset: Int? = null,
    val conversationId: String? = null,
    val turnNumber: Int? = null,
)

private fun AnchorLocator.toColumns(): LocatorColumns = when (this) {
    is AnchorLocator.PdfPageBox -> LocatorColumns(
        type = "PDF_PAGE_BOX",
        key = "PDF:$page:$left:$top:$right:$bottom",
        page = page,
        left = left,
        top = top,
        right = right,
        bottom = bottom,
    )
    is AnchorLocator.ImageRegion -> LocatorColumns(
        type = "IMAGE_REGION",
        key = "IMAGE:$left:$top:$width:$height",
        left = left.toDouble(),
        top = top.toDouble(),
        width = width,
        height = height,
    )
    is AnchorLocator.SheetRange -> LocatorColumns(
        type = "SHEET_RANGE",
        key = "SHEET:${sheet.length}:$sheet:$firstRow:$firstColumn:$lastRow:$lastColumn",
        sheet = sheet,
        firstRow = firstRow,
        firstColumn = firstColumn,
        lastRow = lastRow,
        lastColumn = lastColumn,
    )
    is AnchorLocator.TextSpan -> LocatorColumns(
        type = "TEXT_SPAN",
        key = "TEXT:$startOffset:$endOffset",
        startOffset = startOffset,
        endOffset = endOffset,
    )
    is AnchorLocator.ChatTurn -> LocatorColumns(
        type = "CHAT_TURN",
        key = "CHAT:${conversationId.length}:$conversationId:$turnNumber:$startOffset:$endOffset",
        conversationId = conversationId,
        turnNumber = turnNumber,
        startOffset = startOffset,
        endOffset = endOffset,
    )
}

private fun SourceAnchor.toSourceAnchorEntity(): SourceAnchorEntity {
    val columns = locator.toColumns()
    return SourceAnchorEntity(
        sourceId = sourceId.value,
        variantId = variantId.value,
        anchorKey = columns.key,
        locatorType = columns.type,
        page = columns.page,
        left = columns.left,
        top = columns.top,
        right = columns.right,
        bottom = columns.bottom,
        width = columns.width,
        height = columns.height,
        sheet = columns.sheet,
        firstRow = columns.firstRow,
        firstColumn = columns.firstColumn,
        lastRow = columns.lastRow,
        lastColumn = columns.lastColumn,
        startOffset = columns.startOffset,
        endOffset = columns.endOffset,
        conversationId = columns.conversationId,
        turnNumber = columns.turnNumber,
    )
}

private fun SourceAnchor.toCaptureSessionAnchorEntity(sessionId: CaptureSessionId): CaptureSessionAnchorEntity {
    val columns = locator.toColumns()
    return CaptureSessionAnchorEntity(
        captureSessionId = sessionId.value,
        sourceId = sourceId.value,
        variantId = variantId.value,
        anchorKey = columns.key,
        locatorType = columns.type,
        page = columns.page,
        left = columns.left,
        top = columns.top,
        right = columns.right,
        bottom = columns.bottom,
        width = columns.width,
        height = columns.height,
        sheet = columns.sheet,
        firstRow = columns.firstRow,
        firstColumn = columns.firstColumn,
        lastRow = columns.lastRow,
        lastColumn = columns.lastColumn,
        startOffset = columns.startOffset,
        endOffset = columns.endOffset,
        conversationId = columns.conversationId,
        turnNumber = columns.turnNumber,
    )
}

private fun SourceAnchorEntity.toDomain(): SourceAnchor = SourceAnchor(
    sourceId = SourceId(sourceId),
    variantId = SourceVariantId(variantId),
    locator = persistedLocator(
        locatorType, page, left, top, right, bottom, width, height, sheet,
        firstRow, firstColumn, lastRow, lastColumn, startOffset, endOffset, conversationId, turnNumber,
    ),
)

private fun CaptureSessionAnchorEntity.toDomain(): SourceAnchor = SourceAnchor(
    sourceId = SourceId(sourceId),
    variantId = SourceVariantId(variantId),
    locator = persistedLocator(
        locatorType, page, left, top, right, bottom, width, height, sheet,
        firstRow, firstColumn, lastRow, lastColumn, startOffset, endOffset, conversationId, turnNumber,
    ),
)

@Suppress("LongParameterList")
private fun persistedLocator(
    type: String,
    page: Int?,
    left: Double?,
    top: Double?,
    right: Double?,
    bottom: Double?,
    width: Int?,
    height: Int?,
    sheet: String?,
    firstRow: Int?,
    firstColumn: Int?,
    lastRow: Int?,
    lastColumn: Int?,
    startOffset: Int?,
    endOffset: Int?,
    conversationId: String?,
    turnNumber: Int?,
): AnchorLocator = when (type) {
    "PDF_PAGE_BOX" -> AnchorLocator.PdfPageBox(
        requireNotNull(page), requireNotNull(left), requireNotNull(top), requireNotNull(right), requireNotNull(bottom),
    )
    "IMAGE_REGION" -> AnchorLocator.ImageRegion(
        requireNotNull(left).toInt(), requireNotNull(top).toInt(), requireNotNull(width), requireNotNull(height),
    )
    "SHEET_RANGE" -> AnchorLocator.SheetRange(
        requireNotNull(sheet), requireNotNull(firstRow), requireNotNull(firstColumn), requireNotNull(lastRow), requireNotNull(lastColumn),
    )
    "TEXT_SPAN" -> AnchorLocator.TextSpan(requireNotNull(startOffset), requireNotNull(endOffset))
    "CHAT_TURN" -> AnchorLocator.ChatTurn(
        requireNotNull(conversationId), requireNotNull(turnNumber), startOffset, endOffset,
    )
    else -> error("Unknown persisted anchor locator type: $type")
}

private fun <T> immutableList(values: List<T>): List<T> =
    Collections.unmodifiableList(ArrayList(values))
