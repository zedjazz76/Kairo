package kairo.platform.db

import android.content.Context
import android.database.sqlite.SQLiteConstraintException
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import java.time.Instant
import kairo.application.AuditEvent
import kairo.application.FactQuery
import kairo.domain.AnchorLocator
import kairo.domain.CaptureSession
import kairo.domain.CaptureSessionId
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
import kairo.domain.SourceClassification
import kairo.domain.SourceId
import kairo.domain.SourceOrigin
import kairo.domain.SourceType
import kairo.domain.SourceVariant
import kairo.domain.SourceVariantId
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class RoomKnowledgeRepositoryTest {
    private lateinit var database: KairoDatabase
    private lateinit var repository: RoomKnowledgeRepository

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        database = Room.inMemoryDatabaseBuilder(context, KairoDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        repository = RoomKnowledgeRepository(database)
    }

    @After
    fun tearDown() {
        database.close()
    }

    @Test
    fun `append preserves predecessor and returns lineage history chronologically`() = runTest {
        val source = source("source-history", "hash-history")
        repository.saveSource(source, audit("audit-source-history", "SAVE_SOURCE", source.id.value))
        val first = fact(
            id = "fact-v1",
            lineageId = FactLineageId("fact-lineage"),
            sourceId = source.id.value,
            recordedAt = "2026-08-20T10:00:00Z",
        )
        val second = first.copy(
            id = FactId("fact-v2"),
            objectValue = FactObject.Literal("AbbaDox"),
            recordedAt = Instant.parse("2026-08-20T11:00:00Z"),
            supersedes = first.id,
        )

        repository.appendFactVersion(first, audit("audit-fact-v1", "APPEND_FACT", first.id.value))
        repository.appendFactVersion(second, audit("audit-fact-v2", "APPEND_FACT", second.id.value))

        assertEquals(listOf(first, second), repository.history(first.lineageId))
        assertEquals(listOf(second), repository.currentUnderstanding(FactQuery(first.subject, first.predicate, Instant.parse("2026-08-21T00:00:00Z"))))
        assertEquals(2, rowCount("fact_versions"))
    }

    @Test
    fun `history orders fractional instants chronologically`() = runTest {
        val source = source("source-fractional-history", "hash-fractional-history")
        repository.saveSource(source, audit("audit-source-fractional", "SAVE_SOURCE", source.id.value))
        val first = fact(
            id = "fact-fractional-v1",
            lineageId = FactLineageId("fractional-lineage"),
            sourceId = source.id.value,
            recordedAt = "2026-08-20T10:00:00Z",
        )
        val second = first.copy(
            id = FactId("fact-fractional-v2"),
            recordedAt = Instant.parse("2026-08-20T10:00:00.100Z"),
            supersedes = first.id,
        )

        repository.appendFactVersion(first, audit("audit-fractional-v1", "APPEND_FACT", first.id.value))
        repository.appendFactVersion(second, audit("audit-fractional-v2", "APPEND_FACT", second.id.value))

        assertEquals(listOf(first, second), repository.history(first.lineageId))
    }

    @Test
    fun `fact evidence and audit event roll back when audit insert fails`() = runTest {
        val source = source("source-atomic", "hash-atomic")
        repository.saveSource(source, audit("audit-source-atomic", "SAVE_SOURCE", source.id.value))
        val first = fact("fact-atomic-v1", FactLineageId("atomic-lineage"), source.id.value, "2026-08-20T10:00:00Z")
        val second = first.copy(
            id = FactId("fact-atomic-v2"),
            recordedAt = Instant.parse("2026-08-20T11:00:00Z"),
            supersedes = first.id,
        )
        val reusedAudit = audit("audit-once", "APPEND_FACT", first.id.value)
        repository.appendFactVersion(first, reusedAudit)

        assertFailsWith<SQLiteConstraintException> {
            repository.appendFactVersion(second, reusedAudit.copy(targetId = second.id.value))
        }

        assertEquals(listOf(first), repository.history(first.lineageId))
        assertEquals(1, rowCount("fact_evidence"))
        assertEquals(1, rowCount("audit_events", "audit_id = 'audit-once'"))
    }

    @Test
    fun `duplicate fact version identifiers are rejected without replacing history`() = runTest {
        val source = source("source-duplicate", "hash-duplicate")
        repository.saveSource(source, audit("audit-source-duplicate", "SAVE_SOURCE", source.id.value))
        val original = fact("fact-duplicate", FactLineageId("duplicate-lineage"), source.id.value, "2026-08-20T10:00:00Z")
        repository.appendFactVersion(original, audit("audit-fact-original", "APPEND_FACT", original.id.value))

        assertFailsWith<SQLiteConstraintException> {
            repository.appendFactVersion(
                original.copy(objectValue = FactObject.Literal("replacement")),
                audit("audit-fact-replacement", "APPEND_FACT", original.id.value),
            )
        }

        assertEquals(listOf(original), repository.history(original.lineageId))
    }

    @Test
    fun `current understanding preserves temporal scope object and evidence mapping`() = runTest {
        val source = source("source-map", "hash-map")
        repository.saveSource(source, audit("audit-source-map", "SAVE_SOURCE", source.id.value))
        val expected = FactVersion(
            id = FactId("fact-map"),
            lineageId = FactLineageId("lineage-map"),
            subject = EntityId("system-pacs"),
            predicate = "ROUTES_TO",
            objectValue = FactObject.Entity(EntityId("workstation-a")),
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.OBSERVED,
            effectiveFrom = Instant.parse("2026-01-01T00:00:00Z"),
            effectiveTo = Instant.parse("2027-01-01T00:00:00Z"),
            recordedAt = Instant.parse("2026-08-20T10:00:00Z"),
            lastValidatedAt = Instant.parse("2026-08-20T12:00:00Z"),
            evidence = setOf(EvidenceRef(source.id.value, "page-2", 0.83)),
        )
        repository.appendFactVersion(expected, audit("audit-map", "APPEND_FACT", expected.id.value))

        val actual = repository.currentUnderstanding(
            FactQuery(expected.subject, expected.predicate, Instant.parse("2026-08-21T00:00:00Z")),
        ).single()

        assertEquals(expected, actual)
        assertFailsWith<UnsupportedOperationException> {
            (actual.evidence as MutableSet<EvidenceRef>).clear()
        }
    }

    @Test
    fun `source variants and capture session anchors round trip exactly`() = runTest {
        val expectedSource = sourceWithEveryAnchor()
        repository.saveSource(expectedSource, audit("audit-source-round-trip", "SAVE_SOURCE", expectedSource.id.value))
        val restoredSource = assertNotNull(repository.source(expectedSource.id))

        assertEquals(expectedSource.id, restoredSource.id)
        assertEquals(expectedSource.origin, restoredSource.origin)
        assertEquals(expectedSource.type, restoredSource.type)
        assertEquals(expectedSource.contentHash, restoredSource.contentHash)
        assertEquals(expectedSource.importedAt, restoredSource.importedAt)
        assertEquals(expectedSource.classification, restoredSource.classification)
        assertEquals(expectedSource.anchors, restoredSource.anchors)
        assertEquals(expectedSource.variants.map { it.id }, restoredSource.variants.map { it.id })
        assertEquals(expectedSource.variants.map { it.parentVariantId }, restoredSource.variants.map { it.parentVariantId })
        assertEquals(expectedSource.variants.map { it.anchors }, restoredSource.variants.map { it.anchors })

        val expectedSession = CaptureSession(
            id = CaptureSessionId("capture-round-trip"),
            capturedAt = Instant.parse("2026-08-20T15:00:00Z"),
            anchors = expectedSource.anchors,
            title = "Radiology Workflow review",
        )
        repository.saveCaptureSession(expectedSession, audit("audit-capture-round-trip", "SAVE_CAPTURE_SESSION", expectedSession.id.value))

        val restoredSession = assertNotNull(repository.captureSession(expectedSession.id))
        assertEquals(expectedSession.id, restoredSession.id)
        assertEquals(expectedSession.capturedAt, restoredSession.capturedAt)
        assertEquals(expectedSession.title, restoredSession.title)
        assertEquals(expectedSession.anchors, restoredSession.anchors)
        assertFailsWith<UnsupportedOperationException> {
            (restoredSession.anchors as MutableSet<SourceAnchor>).clear()
        }
    }

    @Test
    fun `duplicate content hashes share identity without collapsing imports`() = runTest {
        val first = source("source-import-a", "shared-hash")
        val second = source("source-import-b", "shared-hash")

        repository.saveSource(first, audit("audit-import-a", "SAVE_SOURCE", first.id.value))
        repository.saveSource(second, audit("audit-import-b", "SAVE_SOURCE", second.id.value))

        assertNotEquals(first.id, second.id)
        assertEquals(1, rowCount("content_identities"))
        assertEquals(2, rowCount("sources"))
        assertEquals("shared-hash", repository.source(first.id)?.contentHash)
        assertEquals("shared-hash", repository.source(second.id)?.contentHash)
    }

    @Test
    fun `capture session rejects an anchor whose variant belongs to another source`() = runTest {
        val first = source("source-anchor-a", "hash-anchor-a")
        val second = source("source-anchor-b", "hash-anchor-b")
        repository.saveSource(first, audit("audit-anchor-a", "SAVE_SOURCE", first.id.value))
        repository.saveSource(second, audit("audit-anchor-b", "SAVE_SOURCE", second.id.value))
        val session = CaptureSession(
            id = CaptureSessionId("capture-incoherent-anchor"),
            capturedAt = Instant.parse("2026-08-20T15:00:00Z"),
            anchors = setOf(
                SourceAnchor(
                    sourceId = first.id,
                    variantId = second.variants.single().id,
                    locator = AnchorLocator.TextSpan(0, 5),
                ),
            ),
        )

        assertFailsWith<SQLiteConstraintException> {
            repository.saveCaptureSession(
                session,
                audit("audit-incoherent-anchor", "SAVE_CAPTURE_SESSION", session.id.value),
            )
        }

        assertEquals(0, rowCount("capture_sessions", "capture_session_id = '${session.id.value}'"))
        assertEquals(0, rowCount("audit_events", "audit_id = 'audit-incoherent-anchor'"))
    }

    private fun rowCount(table: String, where: String? = null): Int {
        val sql = buildString {
            append("SELECT COUNT(*) FROM ")
            append(table)
            if (where != null) append(" WHERE ").append(where)
        }
        database.openHelper.readableDatabase.query(sql).use { cursor ->
            cursor.moveToFirst()
            return cursor.getInt(0)
        }
    }

    private fun fact(
        id: String,
        lineageId: FactLineageId,
        sourceId: String,
        recordedAt: String,
    ) = FactVersion(
        id = FactId(id),
        lineageId = lineageId,
        subject = EntityId("system-ris"),
        predicate = "USES",
        objectValue = FactObject.Literal("Merge RIS"),
        scope = KnowledgeScope.MANA_PRODUCTION,
        state = EvidenceState.CONFIRMED,
        effectiveFrom = Instant.parse("2026-01-01T00:00:00Z"),
        effectiveTo = null,
        recordedAt = Instant.parse(recordedAt),
        lastValidatedAt = Instant.parse(recordedAt),
        evidence = setOf(EvidenceRef(sourceId, "page-1", 0.95)),
    )

    private fun source(id: String, hash: String): Source {
        val sourceId = SourceId(id)
        val variantId = SourceVariantId("$id-v1")
        val importedAt = Instant.parse("2026-08-20T09:00:00Z")
        val variant = SourceVariant(variantId, sourceId, 1, hash, importedAt, null, ExtractionStatus.EXTRACTED, emptySet())
        return Source(sourceId, SourceOrigin.IMPORT, SourceType.PDF, hash, importedAt, SourceClassification.INTERNAL, listOf(variant), emptySet())
    }

    private fun sourceWithEveryAnchor(): Source {
        val sourceId = SourceId("source-round-trip")
        val rootId = SourceVariantId("source-round-trip-v1")
        val childId = SourceVariantId("source-round-trip-v2")
        val importedAt = Instant.parse("2026-08-20T09:00:00Z")
        val rootAnchors = setOf(
            SourceAnchor(sourceId, rootId, AnchorLocator.PdfPageBox(2, 1.0, 2.0, 3.0, 4.0)),
            SourceAnchor(sourceId, rootId, AnchorLocator.ImageRegion(1, 2, 30, 40)),
            SourceAnchor(sourceId, rootId, AnchorLocator.SheetRange("RIS", 1, 2, 3, 4)),
        )
        val childAnchors = setOf(
            SourceAnchor(sourceId, childId, AnchorLocator.TextSpan(5, 15)),
            SourceAnchor(sourceId, childId, AnchorLocator.ChatTurn("conversation-1", 4, 2, 12)),
        )
        val root = SourceVariant(rootId, sourceId, 1, "root-hash", importedAt, null, ExtractionStatus.EXTRACTED, rootAnchors)
        val child = SourceVariant(childId, sourceId, 2, "child-hash", Instant.parse("2026-08-20T10:00:00Z"), rootId, ExtractionStatus.EXTRACTED, childAnchors)
        return Source(
            sourceId,
            SourceOrigin.USER_CAPTURE,
            SourceType.DOCUMENT,
            "root-hash",
            importedAt,
            SourceClassification.CONFIDENTIAL,
            listOf(root, child),
            rootAnchors + childAnchors,
        )
    }

    private fun audit(id: String, action: String, targetId: String) = AuditEvent(
        id = id,
        action = action,
        targetType = "KNOWLEDGE",
        targetId = targetId,
        occurredAt = Instant.parse("2026-08-20T16:00:00Z"),
        correlationId = "correlation-$id",
    )
}
