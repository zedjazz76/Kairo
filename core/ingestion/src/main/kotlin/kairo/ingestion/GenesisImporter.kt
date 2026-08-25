package kairo.ingestion

import java.security.MessageDigest
import java.time.Instant
import java.util.UUID
import kairo.domain.CaptureSessionId
import kairo.domain.ExtractionStatus
import kairo.domain.EvidenceState
import kairo.domain.KnowledgeScope
import kairo.domain.Source
import kairo.domain.SourceAuthority
import kairo.domain.SourceClassification
import kairo.domain.SourceId
import kairo.domain.SourceOrigin
import kairo.domain.SourceType
import kairo.domain.SourceVariant
import kairo.domain.SourceVariantId
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

const val GENESIS_MANIFEST_SCHEMA_VERSION = "genesis-corpus-manifest/v1"

enum class GenesisCorpusStatus {
    READY,
    AWAITING_PRIVATE_SOURCES,
}

enum class GenesisMaterialKind {
    CURATED_MANA_KNOWLEDGE,
    MANA_PRODUCTION_EVIDENCE,
    VENDOR_DOCUMENTATION,
    EXTERNAL_RESEARCH,
    RAW_CONVERSATION,
}

enum class GenesisTemporalDisposition {
    CURRENT,
    PLANNED,
    HISTORICAL,
    UNSPECIFIED,
}

enum class GenesisSensitivityDisposition {
    CLEARED_FOR_DURABLE_IMPORT,
    REDACTED_FOR_DURABLE_IMPORT,
    TEMPORARY_ONLY,
    REJECTED,
}

data class GenesisManifest(
    val schemaVersion: String,
    val corpusStatus: GenesisCorpusStatus,
    val requiredDomainCoverage: Set<String>,
    val entries: List<GenesisManifestEntry>,
)

data class GenesisManifestEntry(
    val id: String,
    val sourceReference: String,
    val contentHash: String,
    val sourceType: SourceType,
    val sourceClassification: SourceClassification,
    val authority: SourceAuthority,
    val expectedScope: KnowledgeScope,
    val expectedEvidenceState: EvidenceState,
    val temporalDisposition: GenesisTemporalDisposition,
    val sensitivityDisposition: GenesisSensitivityDisposition,
    val materialKind: GenesisMaterialKind,
    val domains: Set<String>,
    val projectIds: Set<String>,
)

/** Strict loader for metadata only; Genesis payload bytes never appear in the manifest. */
class GenesisManifestLoader(
    private val json: Json = Json { ignoreUnknownKeys = false },
) {
    fun load(serialized: String): GenesisManifest {
        val root = try {
            json.parseToJsonElement(serialized).jsonObject
        } catch (failure: Exception) {
            throw IllegalArgumentException("Invalid Genesis manifest JSON", failure)
        }

        root.requireOnlyFields(
            setOf("schemaVersion", "corpusStatus", "requiredDomainCoverage", "entries"),
            "manifest",
        )

        val manifest = GenesisManifest(
            schemaVersion = root.requiredString("schemaVersion"),
            corpusStatus = root.requiredEnum("corpusStatus", GenesisCorpusStatus.entries),
            requiredDomainCoverage = root.requiredStringSet("requiredDomainCoverage"),
            entries = root.requiredArray("entries").mapIndexed { index, value ->
                value.jsonObject.toEntry(index)
            },
        )

        validate(manifest)
        return manifest
    }

    private fun JsonObject.toEntry(index: Int): GenesisManifestEntry {
        requireOnlyFields(
            setOf(
                "id",
                "sourceReference",
                "contentHash",
                "sourceType",
                "sourceClassification",
                "authority",
                "expectedScope",
                "expectedEvidenceState",
                "temporalDisposition",
                "sensitivityDisposition",
                "materialKind",
                "domains",
                "projectIds",
            ),
            "entry[$index]",
        )

        return GenesisManifestEntry(
            id = requiredString("id"),
            sourceReference = requiredString("sourceReference"),
            contentHash = requiredString("contentHash"),
            sourceType = requiredEnum("sourceType", SourceType.entries),
            sourceClassification = requiredEnum("sourceClassification", SourceClassification.entries),
            authority = requiredEnum("authority", SourceAuthority.entries.filter { it != SourceAuthority.UNSPECIFIED }),
            expectedScope = requiredEnum("expectedScope", KnowledgeScope.entries),
            expectedEvidenceState = requiredEnum("expectedEvidenceState", EvidenceState.entries),
            temporalDisposition = requiredEnum("temporalDisposition", GenesisTemporalDisposition.entries),
            sensitivityDisposition = requiredEnum("sensitivityDisposition", GenesisSensitivityDisposition.entries),
            materialKind = requiredEnum("materialKind", GenesisMaterialKind.entries),
            domains = requiredStringSet("domains"),
            projectIds = requiredStringSet("projectIds"),
        )
    }

    private fun validate(manifest: GenesisManifest) {
        require(manifest.schemaVersion == GENESIS_MANIFEST_SCHEMA_VERSION) {
            "Unsupported Genesis manifest schemaVersion: ${manifest.schemaVersion}"
        }
        require(manifest.requiredDomainCoverage.isNotEmpty()) {
            "Genesis manifest requiredDomainCoverage must not be empty"
        }
        require(manifest.entries.map { it.id }.toSet().size == manifest.entries.size) {
            "Genesis manifest contains duplicate stable entry identities"
        }
        require(manifest.corpusStatus != GenesisCorpusStatus.READY || manifest.entries.isNotEmpty()) {
            "READY Genesis manifest must contain at least one entry"
        }

        manifest.entries.forEach(::validateEntry)

        if (manifest.corpusStatus == GenesisCorpusStatus.READY) {
            val covered = manifest.entries.flatMap { it.domains }.toSet()
            require(covered.containsAll(manifest.requiredDomainCoverage)) {
                "READY Genesis manifest does not cover every required domain"
            }
        }
    }

    private fun validateEntry(entry: GenesisManifestEntry) {
        require(stableId.matches(entry.id)) { "Genesis entry id is invalid: ${entry.id}" }
        require(sha256.matches(entry.contentHash)) { "Genesis entry contentHash must be a lowercase SHA-256 hex digest" }
        require(privateReference.matches(entry.sourceReference) && !entry.sourceReference.contains("..")) {
            "Genesis entry sourceReference must be a safe private or synthetic logical reference"
        }
        require(entry.domains.isNotEmpty()) { "Genesis entry domains must not be empty" }
        require(entry.sensitivityDisposition in durableSensitivityDispositions) {
            "Genesis entry sensitivityDisposition is unsafe for durable import"
        }

        when (entry.materialKind) {
            GenesisMaterialKind.RAW_CONVERSATION -> {
                require(entry.sourceType == SourceType.CHAT_TRANSCRIPT) {
                    "RAW_CONVERSATION must use CHAT_TRANSCRIPT sourceType"
                }
                require(entry.authority == SourceAuthority.RAW_CONVERSATION) {
                    "RAW_CONVERSATION must retain RAW_CONVERSATION authority"
                }
                require(entry.expectedEvidenceState != EvidenceState.CONFIRMED) {
                    "RAW_CONVERSATION cannot propose CONFIRMED knowledge"
                }
            }

            GenesisMaterialKind.VENDOR_DOCUMENTATION -> {
                require(entry.authority == SourceAuthority.OFFICIAL_VENDOR_DOCUMENTATION) {
                    "VENDOR_DOCUMENTATION must retain OFFICIAL_VENDOR_DOCUMENTATION authority"
                }
                require(entry.expectedScope == KnowledgeScope.PRODUCT) {
                    "VENDOR_DOCUMENTATION must remain PRODUCT knowledge"
                }
            }

            GenesisMaterialKind.MANA_PRODUCTION_EVIDENCE -> {
                require(entry.expectedScope == KnowledgeScope.MANA_PRODUCTION) {
                    "MANA_PRODUCTION_EVIDENCE must target MANA_PRODUCTION scope"
                }
                require(entry.authority in manaProductionAuthorities) {
                    "MANA_PRODUCTION_EVIDENCE requires direct production or configuration authority"
                }
            }

            GenesisMaterialKind.EXTERNAL_RESEARCH -> {
                require(entry.expectedScope == KnowledgeScope.EXTERNAL_RESEARCH) {
                    "EXTERNAL_RESEARCH material must remain EXTERNAL_RESEARCH knowledge"
                }
            }

            GenesisMaterialKind.CURATED_MANA_KNOWLEDGE -> Unit
        }

        when (entry.temporalDisposition) {
            GenesisTemporalDisposition.CURRENT -> require(entry.expectedEvidenceState != EvidenceState.PLANNED) {
                "CURRENT Genesis material cannot be PLANNED"
            }

            GenesisTemporalDisposition.PLANNED -> require(
                entry.expectedEvidenceState in setOf(EvidenceState.PLANNED, EvidenceState.PROPOSED, EvidenceState.VERIFY),
            ) {
                "PLANNED Genesis material must retain PLANNED, PROPOSED, or VERIFY evidence state"
            }

            GenesisTemporalDisposition.HISTORICAL,
            GenesisTemporalDisposition.UNSPECIFIED,
            -> Unit
        }
    }

    private companion object {
        val stableId = Regex("[a-z][a-z0-9-]{2,127}")
        val sha256 = Regex("[a-f0-9]{64}")
        val privateReference = Regex("(?:private|synthetic)://[A-Za-z0-9._/-]+")
        val durableSensitivityDispositions = setOf(
            GenesisSensitivityDisposition.CLEARED_FOR_DURABLE_IMPORT,
            GenesisSensitivityDisposition.REDACTED_FOR_DURABLE_IMPORT,
        )
        val manaProductionAuthorities = setOf(
            SourceAuthority.MANA_PRODUCTION_VALIDATION,
            SourceAuthority.MANA_CONFIGURATION_EVIDENCE,
        )
    }
}

class GenesisSourcePayload(
    val fileName: String,
    bytes: ByteArray,
    val mediaType: String? = null,
) {
    val bytes: ByteArray = bytes.copyOf()
}

fun interface GenesisPayloadResolver {
    fun resolve(entry: GenesisManifestEntry): GenesisSourcePayload?
}

/** The production host adapts this port to its existing Source repository boundary. */
fun interface GenesisSourceRecorder {
    fun record(source: Source)
}

/** The production host adapts this port to the existing MemoryInboxService.receive boundary. */
fun interface GenesisCandidateReceiver {
    fun receive(candidate: MemoryCandidateDraft)
}

fun interface GenesisCandidateFactory {
    fun create(entry: GenesisManifestEntry, result: IngestionResult): List<MemoryCandidateDraft>
}

private object ManifestGenesisCandidateFactory : GenesisCandidateFactory {
    override fun create(
        entry: GenesisManifestEntry,
        result: IngestionResult,
    ): List<MemoryCandidateDraft> = result.candidates.map { candidate ->
        candidate.copy(
            proposedScope = entry.expectedScope,
            proposedState = entry.expectedEvidenceState,
        )
    }
}

data class GenesisImportEntryResult(
    val entryId: String,
    val stage: IngestionStage,
    val candidates: List<MemoryCandidateDraft>,
    val source: Source? = null,
)

data class GenesisImportResult(
    val entries: List<GenesisImportEntryResult>,
) {
    val candidates: List<MemoryCandidateDraft> = entries.flatMap { it.candidates }
}

/**
 * Composes manifest metadata with the existing ingestion pipeline. It neither
 * writes facts nor promotes candidates: Memory Inbox remains the only path to
 * active knowledge.
 */
class GenesisImporter(
    private val pipeline: IngestionPipeline,
    private val payloadResolver: GenesisPayloadResolver,
    private val sourceRecorder: GenesisSourceRecorder,
    private val candidateReceiver: GenesisCandidateReceiver,
    private val candidateFactory: GenesisCandidateFactory = ManifestGenesisCandidateFactory,
    private val now: () -> Instant = Instant::now,
) {
    fun import(manifest: GenesisManifest): GenesisImportResult = GenesisImportResult(
        entries = manifest.entries.map(::importEntry),
    )

    private fun importEntry(entry: GenesisManifestEntry): GenesisImportEntryResult {
        val payload = requireNotNull(payloadResolver.resolve(entry)) {
            "Genesis source payload is unavailable for ${entry.id}"
        }
        require(payload.bytes.sha256() == entry.contentHash) {
            "Genesis source payload hash does not match manifest for ${entry.id}"
        }

        val sourceId = SourceId(entry.id)
        val variantId = SourceVariantId("${entry.id}-v1")
        val result = pipeline.run(
            IngestionRequest(
                // Pipeline payloads are intentionally cleared on completion, so each
                // repeatable import attempt needs its own transient ingestion session.
                // Source identity remains the stable manifest entry ID and hash.
                sessionId = CaptureSessionId("genesis-${entry.id}-${entry.contentHash.take(12)}-${UUID.randomUUID()}"),
                artifacts = listOf(
                    IngestionArtifact(
                        sourceId = sourceId,
                        variantId = variantId,
                        fileName = payload.fileName,
                        bytes = payload.bytes,
                        mediaType = payload.mediaType,
                    ),
                ),
                capturedAt = now(),
            ),
        )

        if (result.stage != IngestionStage.COMPLETE) {
            return GenesisImportEntryResult(entry.id, result.stage, emptyList())
        }

        val anchors = result.artifacts.flatMap { it.extracted.anchors }.toSet()
        val importedAt = now()
        val source = Source(
            id = sourceId,
            origin = SourceOrigin.IMPORT,
            type = entry.sourceType,
            contentHash = entry.contentHash,
            importedAt = importedAt,
            classification = entry.sourceClassification,
            variants = listOf(
                SourceVariant(
                    id = variantId,
                    sourceId = sourceId,
                    version = 1,
                    contentHash = entry.contentHash,
                    importedAt = importedAt,
                    parentVariantId = null,
                    extractionStatus = ExtractionStatus.EXTRACTED,
                    anchors = anchors,
                ),
            ),
            anchors = anchors,
            authority = entry.authority,
        )
        sourceRecorder.record(source)

        val candidates = candidateFactory.create(entry, result)
        candidates.forEach(candidateReceiver::receive)
        return GenesisImportEntryResult(entry.id, result.stage, candidates, source)
    }
}

private fun JsonObject.requiredString(name: String): String =
    requireNotNull(this[name] as? JsonPrimitive) { "Genesis manifest is missing $name" }
        .content
        .also { require(it.isNotBlank()) { "Genesis manifest $name must not be blank" } }

private fun JsonObject.requiredArray(name: String): JsonArray =
    requireNotNull(this[name] as? JsonArray) { "Genesis manifest is missing $name" }

private fun JsonObject.requiredStringSet(name: String): Set<String> =
    requiredArray(name).mapIndexed { index, value ->
        val item = (value as? JsonPrimitive)?.content
            ?: throw IllegalArgumentException("Genesis manifest $name[$index] must be a string")
        require(item.isNotBlank()) { "Genesis manifest $name[$index] must not be blank" }
        item
    }.toSet().also { values ->
        require(values.size == requiredArray(name).size) { "Genesis manifest $name must not contain duplicates" }
    }

private fun <T : Enum<T>> JsonObject.requiredEnum(name: String, values: List<T>): T {
    val serialized = requiredString(name)
    return values.firstOrNull { it.name == serialized }
        ?: throw IllegalArgumentException("Unknown Genesis manifest $name: $serialized")
}

private fun JsonObject.requireOnlyFields(allowed: Set<String>, location: String) {
    val unexpected = keys - allowed
    require(unexpected.isEmpty()) {
        "Unknown Genesis manifest fields at $location: ${unexpected.sorted().joinToString(", ")}"
    }
}

private fun ByteArray.sha256(): String = MessageDigest.getInstance("SHA-256")
    .digest(this)
    .joinToString("") { byte -> "%02x".format(byte) }
