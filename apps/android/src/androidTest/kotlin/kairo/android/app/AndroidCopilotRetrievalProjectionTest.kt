package kairo.android.app

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.time.Instant
import kairo.application.AuditEvent
import kairo.domain.EntityId
import kairo.domain.EvidenceRef
import kairo.domain.EvidenceState
import kairo.domain.FactId
import kairo.domain.FactLineageId
import kairo.domain.FactObject
import kairo.domain.FactVersion
import kairo.domain.KnowledgeScope
import kairo.domain.ExtractionStatus
import kairo.domain.Source
import kairo.domain.SourceAuthority
import kairo.domain.SourceClassification
import kairo.domain.SourceId
import kairo.domain.SourceOrigin
import kairo.domain.SourceType
import kairo.domain.SourceVariant
import kairo.domain.SourceVariantId
import kairo.platform.db.KairoDatabase
import kairo.platform.db.RoomKnowledgeRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidCopilotRetrievalProjectionTest {

    @Test
    fun copilot_retains_independent_mana_uses_facts_from_room() = runBlocking {
        val (database, repository) = openRepository()

        repository.appendFact(manaFact("fact-a-pacs", "Merge / AMICAS PACS"))
        repository.appendFact(manaFact("fact-z-ris", "Merge RIS"))

        val answer = KairoCompositionRoot.fromRepository(repository)
            .copilot
            .ask("What PACS does MANA use?")

        assertTrue(answer.text.contains("Merge / AMICAS PACS"))
        database.close()
    }

    @Test
    fun copilot_qualifies_planned_project_transition_from_room() = runBlocking {
        val (database, repository) = openRepository()
        repository.appendFact(
            fact(
                id = "fact-abbadox-transition",
                subject = "merge-ris",
                predicate = "REPLACED_BY",
                value = "AbbaDox CareFlow for non-breast imaging",
                scope = KnowledgeScope.PROJECT,
                state = EvidenceState.PLANNED,
            ),
        )

        val answer = KairoCompositionRoot.fromRepository(repository)
            .copilot
            .ask("What is planned for the Merge RIS transition?")

        assertTrue(answer.text.contains("Planned"))
        assertTrue(answer.text.contains("[PROJECT]"))
        assertTrue(answer.text.contains("AbbaDox CareFlow"))
        database.close()
    }

    @Test
    fun copilot_keeps_viewpoint_direction_planned_from_room() = runBlocking {
        val (database, repository) = openRepository()
        repository.appendFact(
            fact(
                id = "fact-viewpoint-direction",
                subject = "ge-viewpoint",
                predicate = "REPLACED_BY",
                value = "Rad AI direction",
                scope = KnowledgeScope.PROJECT,
                state = EvidenceState.PLANNED,
            ),
        )

        val answer = KairoCompositionRoot.fromRepository(repository)
            .copilot
            .ask("What is the planned ViewPoint replacement direction?")

        assertTrue(answer.text.contains("Planned"))
        assertTrue(answer.text.contains("[PROJECT]"))
        assertTrue(answer.text.contains("Rad AI direction"))
        database.close()
    }

    @Test
    fun copilot_qualifies_unknown_altamont_endpoint_from_room() = runBlocking {
        val (database, repository) = openRepository()
        repository.appendFact(
            fact(
                id = "fact-altamont-routing",
                subject = "altamont",
                predicate = "STATES",
                value = "exact AE Title and port require verification",
                scope = KnowledgeScope.PROJECT,
                state = EvidenceState.VERIFY,
            ),
        )

        val answer = KairoCompositionRoot.fromRepository(repository)
            .copilot
            .ask("What is the exact Altamont AE Title and port?")

        assertTrue(answer.text.contains("requires verification", ignoreCase = true))
        assertTrue(answer.text.contains("[PROJECT]"))
        database.close()
    }

    @Test
    fun copilot_keeps_incident_scoped_gsps_evidence_available_from_room() = runBlocking {
        val (database, repository) = openRepository()
        repository.appendFact(
            fact(
                id = "fact-gsps-forwarding",
                subject = "gsps-forwarding-incident",
                predicate = "DEPENDS_ON",
                value = "GSPS forwarding depends on destination transfer syntax support",
                scope = KnowledgeScope.INCIDENT,
                state = EvidenceState.HYPOTHESIS,
            ),
        )

        val answer = KairoCompositionRoot.fromRepository(repository)
            .copilot
            .ask("What do we know about the GSPS forwarding issue?")

        assertTrue(answer.text.contains("GSPS forwarding"))
        assertTrue(answer.text.contains("[INCIDENT]"))
        database.close()
    }

    private fun manaFact(id: String, value: String) =
        fact(id, "mana", "USES", value, KnowledgeScope.MANA_PRODUCTION, EvidenceState.OBSERVED)

    private fun fact(
        id: String,
        subject: String,
        predicate: String,
        value: String,
        scope: KnowledgeScope,
        state: EvidenceState,
    ) = FactVersion(
        id = FactId(id),
        lineageId = FactLineageId(id),
        subject = EntityId(subject),
        predicate = predicate,
        objectValue = FactObject.Literal(value),
        scope = scope,
        state = state,
        effectiveFrom = null,
        effectiveTo = null,
        recordedAt = Instant.parse("2026-08-25T12:00:00Z"),
        lastValidatedAt = null,
        evidence = setOf(EvidenceRef("curated-mana-discovery", "$id-anchor", 1.0)),
    )

    private suspend fun openRepository(): Pair<KairoDatabase, RoomKnowledgeRepository> {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val database = KairoDatabaseFactory.open(context)
        database.clearAllTables()
        return database to RoomKnowledgeRepository(database).also { it.saveCuratedSource() }
    }

    private suspend fun RoomKnowledgeRepository.appendFact(fact: FactVersion) {
        appendFactVersion(
            fact = fact,
            audit = AuditEvent(
                id = "audit-${fact.id.value}",
                action = "MEMORY_APPROVED",
                targetType = "FACT_VERSION",
                targetId = fact.id.value,
                occurredAt = fact.recordedAt,
                correlationId = "genesis-session",
            ),
        )
    }

    private suspend fun RoomKnowledgeRepository.saveCuratedSource() {
        val sourceId = SourceId("curated-mana-discovery")
        val importedAt = Instant.parse("2026-08-25T12:00:00Z")
        saveSource(
            source = Source(
                id = sourceId,
                origin = SourceOrigin.IMPORT,
                type = SourceType.TEXT,
                contentHash = "curated-hash",
                importedAt = importedAt,
                classification = SourceClassification.CONFIDENTIAL,
                authority = SourceAuthority.MANA_OBSERVED_HISTORY,
                variants = listOf(
                    SourceVariant(
                        id = SourceVariantId("curated-mana-discovery-v1"),
                        sourceId = sourceId,
                        version = 1,
                        contentHash = "curated-hash",
                        importedAt = importedAt,
                        parentVariantId = null,
                        extractionStatus = ExtractionStatus.EXTRACTED,
                        anchors = emptySet(),
                    ),
                ),
                anchors = emptySet(),
            ),
            audit = AuditEvent(
                id = "audit-curated-mana-discovery",
                action = "SOURCE_IMPORTED",
                targetType = "SOURCE",
                targetId = sourceId.value,
                occurredAt = importedAt,
                correlationId = "genesis-session",
            ),
        )
    }
}
