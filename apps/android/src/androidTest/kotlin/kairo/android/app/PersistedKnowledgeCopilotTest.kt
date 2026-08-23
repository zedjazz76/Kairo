package kairo.android.app

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.time.Instant
import kairo.application.AuditEvent
import kairo.domain.EntityId
import kairo.domain.EvidenceRef
import kairo.domain.EvidenceState
import kairo.domain.ExtractionStatus
import kairo.domain.Source
import kairo.domain.SourceClassification
import kairo.domain.SourceId
import kairo.domain.SourceOrigin
import kairo.domain.SourceType
import kairo.domain.SourceVariant
import kairo.domain.SourceVariantId
import kairo.domain.FactId
import kairo.domain.FactLineageId
import kairo.domain.FactObject
import kairo.domain.FactVersion
import kairo.domain.KnowledgeScope
import kairo.platform.db.RoomKnowledgeRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PersistedKnowledgeCopilotTest {

    @Test
    fun copilot_answers_from_fact_persisted_in_room() =
        runBlocking {
            val context =
                ApplicationProvider.getApplicationContext<
                    android.content.Context
                >()

            val database =
                KairoDatabaseFactory.open(
                    context = context,
                )

            database.clearAllTables()

            val repository =
                RoomKnowledgeRepository(
                    database = database,
                )

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
                                anchor = "instrumentation-fixture",
                                extractionConfidence = 1.0,
                            ),
                        ),
                )

            val sourceId =
                SourceId("source-dmwl-host")

            val source =
                Source(
                    id = sourceId,
                    origin = SourceOrigin.USER_CAPTURE,
                    type = SourceType.TEXT,
                    contentHash = "sha256:test-dmwl-host",
                    importedAt =
                        Instant.parse(
                            "2026-08-22T00:00:00Z",
                        ),
                    classification =
                        SourceClassification.INTERNAL,
                    variants =
                        listOf(
                            SourceVariant(
                                id =
                                    SourceVariantId(
                                        "source-dmwl-host:v1",
                                    ),
                                sourceId = sourceId,
                                version = 1,
                                contentHash =
                                    "sha256:test-dmwl-host",
                                importedAt =
                                    Instant.parse(
                                        "2026-08-22T00:00:00Z",
                                    ),
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
                        id = "audit-source-dmwl-host",
                        action = "SAVE_SOURCE",
                        targetType = "SOURCE",
                        targetId = source.id.value,
                        occurredAt =
                            Instant.parse(
                                "2026-08-22T00:00:00Z",
                            ),
                        correlationId =
                            "test-persisted-knowledge",
                    ),
            )

            repository.appendFactVersion(
                fact = fact,
                audit =
                    AuditEvent(
                        id = "audit-dmwl-host",
                        action = "APPEND_FACT_VERSION",
                        targetType = "FACT_VERSION",
                        targetId = fact.id.value,
                        occurredAt =
                            Instant.parse(
                                "2026-08-22T00:00:01Z",
                            ),
                        correlationId =
                            "test-persisted-knowledge",
                    ),
            )

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
                answer,
            )

            database.close()
        }
}
