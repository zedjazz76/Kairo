package kairo.android.tunnel

import java.util.UUID
import kairo.domain.KnowledgeScope
import kairo.retrieval.HybridRetriever
import kairo.retrieval.RetrievalQuery
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

fun interface CoreCommandDispatcher {
    fun dispatch(commandJson: String): String
}

class SearchKnowledgeCoreCommandDispatcher(
    private val retriever: HybridRetriever,
    private val scope: KnowledgeScope = KnowledgeScope.MANA_PRODUCTION,
) : CoreCommandDispatcher {

    override fun dispatch(commandJson: String): String {
        val command = parseSearchCommand(commandJson)
        val bundle = retriever.retrieve(
            RetrievalQuery(
                text = command.query,
                scope = scope,
            ),
        )
        val resultRefs = linkedSetOf<String>().apply {
            bundle.rankedClaims
                .filter { it.lexicalMatches > 0 }
                .forEach { add(it.fact.id.value) }
            bundle.sources
                .filter { it.score > 0 }
                .forEach { add(it.memoryId ?: it.sourceId) }
            bundle.incidents.forEach { add(it.id.value) }
        }

        return if (resultRefs.isEmpty()) {
            errorResult(command.requestId)
        } else {
            successResult(command.requestId, resultRefs.toList())
        }
    }

    private fun successResult(requestId: String, resultRefs: List<String>): String =
        buildJsonObject {
            put("requestId", requestId)
            put("type", SEARCH_KNOWLEDGE)
            put("contractVersion", CONTRACT_VERSION)
            put("status", "SUCCESS")
            put(
                "data",
                buildJsonObject {
                    put(
                        "resultRefs",
                        buildJsonArray {
                            resultRefs.forEach { add(JsonPrimitive(it)) }
                        },
                    )
                },
            )
        }.toString()

    private fun errorResult(requestId: String): String =
        buildJsonObject {
            put("requestId", requestId)
            put("type", SEARCH_KNOWLEDGE)
            put("contractVersion", CONTRACT_VERSION)
            put("status", "ERROR")
            put(
                "error",
                buildJsonObject { put("code", "NOT_FOUND") },
            )
        }.toString()

    private fun parseSearchCommand(commandJson: String): SearchCommand {
        val root = Json.parseToJsonElement(commandJson) as? JsonObject
            ?: throw IllegalArgumentException("invalid_request")
        require(root.keys == setOf("requestId", "type", "contractVersion", "payload")) {
            "invalid_request"
        }
        val requestId = root.string("requestId")
        require(runCatching { UUID.fromString(requestId) }.isSuccess) { "invalid_request" }
        require(root.string("type") == SEARCH_KNOWLEDGE) { "invalid_request" }
        require(root.string("contractVersion") == CONTRACT_VERSION) { "invalid_request" }
        val payload = root.getValue("payload").jsonObject
        require(payload.keys == setOf("query")) { "invalid_request" }
        val query = payload.string("query").trim()
        require(query.isNotEmpty()) { "invalid_request" }
        return SearchCommand(requestId = requestId, query = query)
    }

    private data class SearchCommand(
        val requestId: String,
        val query: String,
    )

    private companion object {
        const val SEARCH_KNOWLEDGE = "SearchKnowledge"
        const val CONTRACT_VERSION = "v1"
    }
}

class EncryptedCoreRequestProcessor(
    private val sessionId: String,
    private val expiresAt: Long,
    sessionKey: ByteArray,
    private val dispatcher: CoreCommandDispatcher,
    private val now: () -> Long = System::currentTimeMillis,
) {
    private val sessionKey = sessionKey.copyOf()
    private var receivedSequence = 0L
    private var sentSequence = 0L

    fun process(frame: TunnelFrame): TunnelFrame {
        check(expiresAt > now()) { "session_expired" }
        require(frame.sessionId == sessionId) { "tunnel_session_mismatch" }
        require(frame.expiresAt == expiresAt && frame.expiresAt > now()) { "session_expired" }
        require(frame.sequence > receivedSequence) { "replay_detected" }

        val plaintext = AndroidTunnelCrypto.decryptFrame(sessionKey, frame)
        receivedSequence = frame.sequence
        val result = dispatcher.dispatch(plaintext)
        sentSequence += 1

        return AndroidTunnelCrypto.encryptFrame(
            sessionKey = sessionKey,
            metadata = TunnelFrameMetadata(
                sessionId = sessionId,
                sequence = sentSequence,
                expiresAt = expiresAt,
            ),
            plaintext = result,
        )
    }
}

private fun JsonObject.string(name: String): String =
    getValue(name).jsonPrimitive.content
