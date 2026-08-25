package kairo.application

import java.nio.file.Files
import java.nio.file.Path
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kairo.domain.CaptureSession
import kairo.domain.EvidenceState
import kairo.domain.FactLineageId
import kairo.domain.FactVersion
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
import kairo.retrieval.HybridRetriever
import kairo.retrieval.RetrievalQuery
import kairo.security.SensitiveContentScan
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class GenesisPrivateBenchmarkTest {

    @Test
    fun `local curated Genesis seed retrieves evidence-aware MANA knowledge`() = runTest {
        val seedPath = privateSeedPath() ?: return@runTest
        val payload = Files.readAllBytes(seedPath)
        val manifest = GenesisManifestLoader().load(
            Files.readString(projectFile("validation/corpus/genesis-manifest.json")),
        )
        val repository = BenchmarkRepository()
        val inbox = MemoryInboxService(repository)
        val importer = GenesisImporter(
            pipeline = IngestionPipeline(
                extractors = listOf(CuratedGenesisSeedExtractor()),
                scanner = { SensitiveContentScan(emptyList()) },
            ),
            payloadResolver = GenesisPayloadResolver {
                GenesisSourcePayload(
                    fileName = "curated-mana-discovery.v1.json",
                    bytes = payload,
                    mediaType = "text/plain",
                )
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

        val staged = bootstrap.stage(manifest)
        assertTrue(staged.pendingCandidates > 20)
        assertTrue(repository.facts.isEmpty())
        assertEquals(staged.pendingCandidates, bootstrap.approveStaged(staged.sourceIds, "LOCAL_OWNER"))
        assertTrue(repository.facts.all { fact ->
            fact.evidence.any { evidence -> evidence.sourceId == "curated-mana-discovery" }
        })

        val copilot = AskKairoService(
            retriever = HybridRetriever(repository.facts),
            reasoningProvider = unavailableReasoningProvider,
            now = { Instant.parse("2026-08-24T12:00:00Z") },
        )

        assertContains(copilot.quick("What PACS does MANA use?").text, "Merge / AMICAS PACS")
        assertContains(copilot.quick("What monitors PACS?").text, "AMICAS Watch")
        assertContains(copilot.quick("Who hosts modality worklist?").text, "DICOM Modality Worklist")
        assertContains(copilot.quick("Does Breast use PowerScribe for dictation?").text, "Dragon One")
        assertContains(copilot.quick("What is the planned ViewPoint replacement direction?").text, "planned")
        assertContains(copilot.quick("What do we know about the GSPS forwarding issue?").text, "GSPS")
        assertContains(
            copilot.quick("What is the exact Altamont endpoint and port?").text,
            "verification",
        )
        assertEquals(
            "I don't know from the available MANA evidence.",
            copilot.quick("Which unmentioned vendor runs a production endpoint?").text,
        )
        assertTrue(repository.facts.any { it.state == EvidenceState.PLANNED })

        val benchmark = readBenchmark()
        assertEquals(14, benchmark.size)
        benchmark.forEach { case ->
            val answer = copilot.quick(case.question).text
            val matches =
                HybridRetriever(repository.facts)
                    .retrieve(RetrievalQuery(case.question, kairo.domain.KnowledgeScope.MANA_PRODUCTION))
                    .rankedClaims
                    .filter { it.lexicalMatches > 0 }

            if (case.outcome == "QUALIFIED_UNKNOWN") {
                assertTrue(
                    answer == "I don't know from the available MANA evidence." ||
                        answer.contains("requires verification", ignoreCase = true),
                    "${case.id} must remain unknown or explicitly require verification",
                )
            } else {
                assertTrue(matches.isNotEmpty(), "${case.id} must retrieve evidence")
                assertTrue(matches.all { it.fact.evidence.isNotEmpty() }, "${case.id} must retain evidence")
                assertTrue(
                    case.requiredScopes.all { required -> matches.any { it.fact.scope.name == required } },
                    "${case.id} must retrieve every required scope",
                )
                assertTrue(
                    matches.any { it.fact.state.name in case.allowedEvidenceStates },
                    "${case.id} must retain an allowed evidence state",
                )
            }
        }
    }

    private fun readBenchmark(): List<BenchmarkCase> {
        val questions = Json.parseToJsonElement(Files.readString(projectFile("validation/benchmarks/questions.v1.json")))
            .jsonObject
            .requiredArray("cases")
            .map { entry ->
                val item = entry.jsonObject
                BenchmarkQuestion(
                    id = item.requiredString("id"),
                    question = item.requiredString("question"),
                )
            }
        val expectations = Json.parseToJsonElement(Files.readString(projectFile("validation/benchmarks/expected.v1.json")))
            .jsonObject
            .requiredArray("expectations")
            .associate { entry ->
                val item = entry.jsonObject
                item.requiredString("caseId") to BenchmarkExpectation(
                    outcome = item.requiredString("outcome"),
                    requiredScopes = item.requiredStringSet("requiredScopes"),
                    allowedEvidenceStates = item.requiredStringSet("allowedEvidenceStates"),
                )
            }

        assertEquals(questions.map { it.id }.toSet(), expectations.keys)
        return questions.map { question ->
            val expectation = requireNotNull(expectations[question.id])
            BenchmarkCase(
                id = question.id,
                question = question.question,
                outcome = expectation.outcome,
                requiredScopes = expectation.requiredScopes,
                allowedEvidenceStates = expectation.allowedEvidenceStates,
            )
        }
    }

    private class BenchmarkRepository : KnowledgeRepository {
        val facts = mutableListOf<FactVersion>()
        val sources = mutableListOf<Source>()

        override suspend fun appendFactVersion(fact: FactVersion, audit: AuditEvent) {
            facts += fact
        }

        override suspend fun currentUnderstanding(query: FactQuery): List<FactVersion> = facts

        override suspend fun history(lineageId: FactLineageId): List<FactVersion> =
            facts.filter { it.lineageId == lineageId }

        override suspend fun saveSource(source: Source, audit: AuditEvent) {
            sources += source
        }

        override suspend fun saveCaptureSession(session: CaptureSession, audit: AuditEvent) = Unit
    }

    private fun privateSeedPath(): Path? =
        projectFile(".private/genesis/curated-mana-discovery.v1.json")
            .takeIf(Files::isRegularFile)

    private fun projectFile(relative: String): Path =
        generateSequence(Path.of("").toAbsolutePath().normalize()) { it.parent }
            .map { it.resolve(relative) }
            .firstOrNull(Files::exists)
            ?: Path.of(relative)

    private fun assertContains(actual: String, expected: String) {
        assertTrue(actual.contains(expected, ignoreCase = true), "Expected '$actual' to contain '$expected'")
    }

    private data class BenchmarkQuestion(
        val id: String,
        val question: String,
    )

    private data class BenchmarkExpectation(
        val outcome: String,
        val requiredScopes: Set<String>,
        val allowedEvidenceStates: Set<String>,
    )

    private data class BenchmarkCase(
        val id: String,
        val question: String,
        val outcome: String,
        val requiredScopes: Set<String>,
        val allowedEvidenceStates: Set<String>,
    )

    private fun JsonObject.requiredString(name: String): String =
        requireNotNull(this[name]) { "Benchmark field $name is missing" }.jsonPrimitive.content

    private fun JsonObject.requiredArray(name: String): JsonArray =
        requireNotNull(this[name]) { "Benchmark field $name is missing" }.jsonArray

    private fun JsonObject.requiredStringSet(name: String): Set<String> =
        requiredArray(name).map { it.jsonPrimitive.content }.toSet()

    private companion object {
        val unavailableReasoningProvider = object : ReasoningProvider {
            override suspend fun analyze(packet: ReasoningPacket): KairoAnswer =
                error("Quick benchmark must not invoke cloud reasoning")
        }
    }
}
