package kairo.android.app

import java.time.Instant
import kairo.application.AuditEvent
import kairo.application.FactQuery
import kairo.application.EvidenceMemoryStore
import kairo.application.KnowledgeRepository
import kairo.android.copilot.ConversationCaptureSession
import kairo.domain.CaptureSession
import kairo.domain.EntityId
import kairo.domain.EvidenceRef
import kairo.domain.EvidenceState
import kairo.domain.FactId
import kairo.domain.FactLineageId
import kairo.domain.FactObject
import kairo.domain.FactVersion
import kairo.domain.KnowledgeScope
import kairo.domain.Source
import kairo.retrieval.EvidenceMemoryKind
import kairo.retrieval.EvidenceMemoryRecord
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test

class KairoRepositoryCompositionTest {

    @Test
    fun root_loads_persisted_evidence_and_records_the_new_conversation() =
        runBlocking {
            val records = mutableListOf(
                EvidenceMemoryRecord(
                    id = "conversation-old-turn-4",
                    sourceId = "conversation-old",
                    kind = EvidenceMemoryKind.CONVERSATION,
                    text = "MagView delivery stopped because the PACS routing destination was wrong.",
                    capturedAt = Instant.parse("2026-08-29T14:00:00Z"),
                ),
                EvidenceMemoryRecord(
                    id = "upload-1-page-2",
                    sourceId = "upload-1",
                    kind = EvidenceMemoryKind.UPLOAD,
                    text = "The breast workflow document says PACS forwards studies to MagView for interpretation.",
                    capturedAt = Instant.parse("2026-08-29T14:05:00Z"),
                ),
            )
            val repository = object : KnowledgeRepository, EvidenceMemoryStore {
                override suspend fun currentUnderstanding(query: FactQuery): List<FactVersion> = emptyList()
                override suspend fun appendFactVersion(fact: FactVersion, audit: AuditEvent) = Unit
                override suspend fun history(lineageId: FactLineageId): List<FactVersion> = emptyList()
                override suspend fun saveSource(source: Source, audit: AuditEvent) = Unit
                override suspend fun saveCaptureSession(session: CaptureSession, audit: AuditEvent) = Unit
                override suspend fun save(record: EvidenceMemoryRecord) {
                    records.removeAll { existing -> existing.id == record.id }
                    records += record
                }
                override suspend fun all(): List<EvidenceMemoryRecord> = records.toList()
            }

            val root = KairoCompositionRoot.fromRepository(
                repository = repository,
                conversation = ConversationCaptureSession("conversation-new"),
            )

            val answer = root.copilot.ask(
                "What did we find when breast images disappeared from the viewer?",
            )

            assertEquals(true, answer.text.contains("routing destination", ignoreCase = true))
            assertEquals(true, answer.text.contains("forwards studies", ignoreCase = true))
            assertEquals(
                listOf("conversation-new-turn-0", "conversation-new-turn-1"),
                records.takeLast(2).map { it.id },
            )
        }

    @Test
    fun root_loads_current_understanding_from_repository() =
        runBlocking {
            val fact =
                FactVersion(
                    id = FactId("fact-dmwl-host"),
                    lineageId =
                        FactLineageId("lineage-dmwl-host"),
                    subject =
                        EntityId("modality-worklist"),
                    predicate = "hosted-by",
                    objectValue =
                        FactObject.Literal(
                            "Merge PACS hosts the modality worklist.",
                        ),
                    scope =
                        KnowledgeScope.MANA_PRODUCTION,
                    state =
                        EvidenceState.CONFIRMED,
                    effectiveFrom = null,
                    effectiveTo = null,
                    recordedAt =
                        Instant.parse(
                            "2026-08-22T00:00:00Z",
                        ),
                    lastValidatedAt = null,
                    evidence =
                        setOf(
                            EvidenceRef(
                                sourceId = "source-dmwl-host",
                                anchor = "repository-fixture",
                                extractionConfidence = 1.0,
                            ),
                        ),
                )

            val repository =
                object : KnowledgeRepository {
                    override suspend fun currentUnderstanding(
                        query: FactQuery,
                    ): List<FactVersion> =
                        listOf(fact)

                    override suspend fun appendFactVersion(
                        fact: FactVersion,
                        audit: AuditEvent,
                    ) = Unit

                    override suspend fun history(
                        lineageId: FactLineageId,
                    ): List<FactVersion> =
                        emptyList()

                    override suspend fun saveSource(
                        source: Source,
                        audit: AuditEvent,
                    ) = Unit

                    override suspend fun saveCaptureSession(
                        session: CaptureSession,
                        audit: AuditEvent,
                    ) = Unit
                }

            val root =
                KairoCompositionRoot.fromRepository(
                    repository = repository,
                )

            val answer =
                root.copilot.ask(
                    "Who hosts the modality worklist?",
                )

            assertEquals(
                "Merge PACS hosts the modality worklist.",
                answer.text,
            )
        }
}
