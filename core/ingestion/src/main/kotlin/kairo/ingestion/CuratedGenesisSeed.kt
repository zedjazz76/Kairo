package kairo.ingestion

import kairo.domain.AnchorLocator
import kairo.domain.EvidenceState
import kairo.domain.KnowledgeScope
import kairo.domain.SourceAnchor
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

const val CURATED_GENESIS_SEED_SCHEMA_VERSION = "kairo-curated-genesis-seed/v1"

data class CuratedGenesisSeed(
    val facts: List<CuratedGenesisSeedFact>,
)

data class CuratedGenesisSeedFact(
    val id: String,
    val subjectLabel: String,
    val predicate: String,
    val objectValue: String,
    val statement: String,
    val scope: KnowledgeScope,
    val evidenceState: EvidenceState,
    val statementStartOffset: Int,
) {
    val statementEndOffset: Int = statementStartOffset + statement.length
}

/**
 * Decodes the local-only curated seed package. The format deliberately permits
 * only reviewed, non-confirmed statements: production confirmation still needs
 * stronger source authority and a normal Memory Inbox decision.
 */
class CuratedGenesisSeedDecoder(
    private val json: Json = Json { ignoreUnknownKeys = false },
) {
    fun decode(bytes: ByteArray): CuratedGenesisSeed = decode(bytes.decodeToString())

    fun decode(serialized: String): CuratedGenesisSeed {
        val root = try {
            json.parseToJsonElement(serialized).jsonObject
        } catch (failure: Exception) {
            throw IllegalArgumentException("Invalid curated Genesis seed JSON", failure)
        }
        root.requireOnly(setOf("schemaVersion", "facts"), "curated Genesis seed")
        require(root.requiredString("schemaVersion") == CURATED_GENESIS_SEED_SCHEMA_VERSION) {
            "Unsupported curated Genesis seed schemaVersion"
        }

        val facts = root.requiredArray("facts").mapIndexed { index, element ->
            element.jsonObject.toFact(index, serialized)
        }
        require(facts.isNotEmpty()) { "Curated Genesis seed must contain facts" }
        require(facts.map { it.id }.toSet().size == facts.size) {
            "Curated Genesis seed contains duplicate fact identities"
        }
        return CuratedGenesisSeed(facts)
    }

    private fun JsonObject.toFact(index: Int, serialized: String): CuratedGenesisSeedFact {
        requireOnly(
            setOf("id", "subjectLabel", "predicate", "objectValue", "statement", "scope", "evidenceState"),
            "curated Genesis fact[$index]",
        )
        val id = requiredString("id")
        require(stableId.matches(id)) { "Curated Genesis fact id is invalid: $id" }
        val statement = requiredString("statement")
        require(statement.none { it == '\\' || it == '"' || it.isISOControl() }) {
            "Curated Genesis fact statement must support a stable text anchor"
        }
        val statementStart = serialized.indexOf(statement)
        require(statementStart >= 0 && serialized.indexOf(statement, statementStart + statement.length) < 0) {
            "Curated Genesis fact statement must appear exactly once for evidence anchoring"
        }
        val state = requiredEnum("evidenceState", EvidenceState.entries)
        require(state != EvidenceState.CONFIRMED) {
            "Curated Genesis seed facts cannot be CONFIRMED without direct production evidence"
        }

        return CuratedGenesisSeedFact(
            id = id,
            subjectLabel = requiredString("subjectLabel"),
            predicate = requiredString("predicate"),
            objectValue = requiredString("objectValue"),
            statement = statement,
            scope = requiredEnum("scope", KnowledgeScope.entries),
            evidenceState = state,
            statementStartOffset = statementStart,
        )
    }

    private fun JsonObject.requiredString(name: String): String =
        requireNotNull(this[name] as? JsonPrimitive) {
            "Curated Genesis seed is missing $name"
        }.content.also { value -> require(value.isNotBlank()) { "Curated Genesis seed $name must not be blank" } }

    private fun JsonObject.requiredArray(name: String): JsonArray =
        requireNotNull(this[name] as? JsonArray) { "Curated Genesis seed is missing $name" }

    private fun <T : Enum<T>> JsonObject.requiredEnum(name: String, values: List<T>): T {
        val value = requiredString(name)
        return values.firstOrNull { it.name == value }
            ?: throw IllegalArgumentException("Curated Genesis seed $name is invalid: $value")
    }

    private fun JsonObject.requireOnly(expected: Set<String>, label: String) {
        require(keys == expected) { "$label has unsupported or missing fields" }
    }

    private companion object {
        val stableId = Regex("[a-z][a-z0-9-]{2,127}")
    }
}

class CuratedGenesisSeedExtractor(
    private val decoder: CuratedGenesisSeedDecoder = CuratedGenesisSeedDecoder(),
) : ArtifactExtractor {
    override fun supports(format: ArtifactFormat): Boolean = format == ArtifactFormat.TEXT

    override fun extract(artifact: IngestionArtifact, format: ArtifactFormat): ExtractedArtifact {
        val seed = decoder.decode(artifact.bytes)
        val anchors = seed.facts.map { fact ->
            SourceAnchor(
                sourceId = artifact.sourceId,
                variantId = artifact.variantId,
                locator = AnchorLocator.TextSpan(fact.statementStartOffset, fact.statementEndOffset),
            )
        }.toSet()

        return ExtractedArtifact(
            artifact = artifact,
            format = format,
            text = seed.facts.joinToString("\n") { it.statement },
            anchors = anchors,
        )
    }
}

class CuratedGenesisCandidateFactory(
    private val decoder: CuratedGenesisSeedDecoder = CuratedGenesisSeedDecoder(),
) : GenesisCandidateFactory {
    override fun create(
        entry: GenesisManifestEntry,
        result: IngestionResult,
    ): List<MemoryCandidateDraft> {
        val artifact = result.artifacts.singleOrNull()?.extracted?.artifact
            ?: error("Curated Genesis import requires exactly one extracted artifact")
        val seed = decoder.decode(artifact.bytes)
        return seed.facts.map { fact ->
            MemoryCandidateDraft(
                sessionId = result.sessionId,
                subjectLabel = fact.subjectLabel,
                text = fact.statement,
                evidenceAnchors = setOf(
                    SourceAnchor(
                        sourceId = artifact.sourceId,
                        variantId = artifact.variantId,
                        locator = AnchorLocator.TextSpan(fact.statementStartOffset, fact.statementEndOffset),
                    ),
                ),
                proposedPredicate = fact.predicate,
                proposedObjectValue = fact.objectValue,
                proposedScope = fact.scope,
                proposedState = fact.evidenceState,
            )
        }
    }
}
