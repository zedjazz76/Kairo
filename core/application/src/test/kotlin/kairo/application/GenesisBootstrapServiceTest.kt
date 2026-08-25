package kairo.application

import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kairo.domain.CaptureSession
import kairo.domain.EntityId
import kairo.domain.EvidenceState
import kairo.domain.FactLineageId
import kairo.domain.FactVersion
import kairo.domain.KnowledgeScope
import kairo.domain.Source
import kairo.domain.SourceId
import kairo.ingestion.CuratedGenesisCandidateFactory
import kairo.ingestion.CuratedGenesisSeedExtractor
import kairo.ingestion.GenesisCandidateReceiver
import kairo.ingestion.GenesisImporter
import kairo.ingestion.GenesisManifestLoader
import kairo.ingestion.GenesisPayloadResolver
import kairo.ingestion.GenesisSourcePayload
import kairo.ingestion.GenesisSourceRecorder
import kairo.ingestion.IngestionPipeline
import kairo.security.SensitiveContentScan
import kotlinx.coroutines.test.runTest

class GenesisBootstrapServiceTest {

    @Test
    fun `curated Genesis bootstrap stages evidence then requires explicit inbox approval`() = runTest {
        val payload =
            """
            {
              "schemaVersion": "kairo-curated-genesis-seed/v1",
              "facts": [
                {
                  "id": "current-pacs",
                  "subjectLabel": "MANA",
                  "predicate": "USES",
                  "objectValue": "Merge / AMICAS PACS",
                  "statement": "MANA's observed PACS is Merge / AMICAS PACS.",
                  "scope": "MANA_PRODUCTION",
                  "evidenceState": "OBSERVED"
                },
                {
                  "id": "future-transition",
                  "subjectLabel": "Merge RIS",
                  "predicate": "REPLACED_BY",
                  "objectValue": "AbbaDox CareFlow for non-breast imaging",
                  "statement": "Non-breast imaging is planned to move from Merge RIS to AbbaDox CareFlow.",
                  "scope": "PROJECT",
                  "evidenceState": "PLANNED"
                }
              ]
            }
            """.trimIndent()
        val repository = RecordingKnowledgeRepository()
        val inbox = MemoryInboxService(repository)
        val importer = GenesisImporter(
            pipeline = IngestionPipeline(
                extractors = listOf(CuratedGenesisSeedExtractor()),
                scanner = { SensitiveContentScan(emptyList()) },
            ),
            payloadResolver = GenesisPayloadResolver {
                GenesisSourcePayload("curated-mana-discovery.txt", payload.encodeToByteArray(), "text/plain")
            },
            sourceRecorder = GenesisSourceRecorder { Unit },
            candidateReceiver = GenesisCandidateReceiver { Unit },
            candidateFactory = CuratedGenesisCandidateFactory(),
            now = { Instant.parse("2026-08-24T12:00:00Z") },
        )
        val bootstrap = GenesisBootstrapService(
            importer = importer,
            repository = repository,
            memoryInbox = inbox,
            sourceExists = { sourceId -> repository.sources.any { it.id == sourceId } },
            now = { Instant.parse("2026-08-24T12:00:00Z") },
        )
        val manifest = GenesisManifestLoader().load(
            manifest(payload.sha256()),
        )

        val staged = bootstrap.stage(manifest)

        assertEquals(1, repository.sources.size)
        assertEquals(2, staged.pendingCandidates)
        assertTrue(repository.facts.isEmpty())
        assertEquals(2, inbox.pending().size)

        val approved = bootstrap.approveStaged(
            sourceIds = setOf(SourceId("curated-mana-discovery")),
            reviewer = "LOCAL_OWNER",
        )

        assertEquals(2, approved)
        assertTrue(inbox.pending().isEmpty())
        assertEquals(2, repository.facts.size)
        assertTrue(repository.facts.any { it.predicate == "USES" && it.state == EvidenceState.OBSERVED })
        assertTrue(repository.facts.any { it.scope == KnowledgeScope.PROJECT && it.state == EvidenceState.PLANNED })

        val restaged = bootstrap.stage(manifest)
        assertEquals(0, restaged.pendingCandidates)
        assertEquals(2, repository.facts.size)
    }

    private fun manifest(hash: String): String =
        """
        {
          "schemaVersion": "genesis-corpus-manifest/v1",
          "corpusStatus": "READY",
          "requiredDomainCoverage": ["Synthetic Domain"],
          "entries": [
            {
              "id": "curated-mana-discovery",
              "sourceReference": "synthetic://curated-mana-discovery",
              "contentHash": "$hash",
              "sourceType": "TEXT",
              "sourceClassification": "CONFIDENTIAL",
              "authority": "MANA_OBSERVED_HISTORY",
              "expectedScope": "MANA_PRODUCTION",
              "expectedEvidenceState": "OBSERVED",
              "temporalDisposition": "CURRENT",
              "sensitivityDisposition": "CLEARED_FOR_DURABLE_IMPORT",
              "materialKind": "CURATED_MANA_KNOWLEDGE",
              "domains": ["Synthetic Domain"],
              "projectIds": []
            }
          ]
        }
        """.trimIndent()

    private class RecordingKnowledgeRepository : KnowledgeRepository {
        val facts = mutableListOf<FactVersion>()
        val sources = mutableListOf<Source>()

        override suspend fun appendFactVersion(fact: FactVersion, audit: AuditEvent) {
            facts += fact
        }

        override suspend fun currentUnderstanding(query: FactQuery): List<FactVersion> =
            facts.filter { fact ->
                (query.subject == null || fact.subject == query.subject) &&
                    (query.predicate == null || fact.predicate == query.predicate)
            }

        override suspend fun history(lineageId: FactLineageId): List<FactVersion> =
            facts.filter { it.lineageId == lineageId }

        override suspend fun saveSource(source: Source, audit: AuditEvent) {
            sources += source
        }

        override suspend fun saveCaptureSession(session: CaptureSession, audit: AuditEvent) = Unit
    }

    private fun String.sha256(): String =
        java.security.MessageDigest.getInstance("SHA-256")
            .digest(encodeToByteArray())
            .joinToString("") { byte -> "%02x".format(byte) }
}
