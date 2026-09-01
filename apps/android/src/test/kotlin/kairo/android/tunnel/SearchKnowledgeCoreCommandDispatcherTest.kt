package kairo.android.tunnel

import java.time.Instant
import kairo.retrieval.EvidenceMemoryKind
import kairo.retrieval.EvidenceMemoryRecord
import kairo.retrieval.HybridRetriever
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

class SearchKnowledgeCoreCommandDispatcherTest {

    @Test
    fun `encrypted SearchKnowledge returns related conversation and upload references`() {
        val now = 1_725_000_000_000L
        val expiresAt = now + 60_000
        val sessionKey = ByteArray(32) { index -> (index + 1).toByte() }
        val retriever = HybridRetriever(
            facts = emptyList(),
            evidenceMemory = listOf(
                EvidenceMemoryRecord(
                    id = "conversation-1-turn-4",
                    sourceId = "conversation-1",
                    kind = EvidenceMemoryKind.CONVERSATION,
                    text = "MagView delivery stopped because the PACS routing destination was wrong.",
                    capturedAt = Instant.parse("2026-08-29T14:00:00Z"),
                    conversationId = "conversation-1",
                    turnNumber = 4,
                ),
                EvidenceMemoryRecord(
                    id = "upload-1-page-2",
                    sourceId = "upload-1",
                    kind = EvidenceMemoryKind.UPLOAD,
                    text = "The breast workflow document confirms that PACS forwards studies to MagView for interpretation.",
                    capturedAt = Instant.parse("2026-08-29T14:05:00Z"),
                ),
            ),
        )
        val processor = EncryptedCoreRequestProcessor(
            sessionId = "paired-session",
            expiresAt = expiresAt,
            sessionKey = sessionKey,
            dispatcher = SearchKnowledgeCoreCommandDispatcher(retriever),
            now = { now },
        )
        val command =
            """{"requestId":"8d9dc177-1966-4e4f-948a-e7562f8596d7","type":"SearchKnowledge","contractVersion":"v1","payload":{"query":"What did we find when breast images were missing from the viewer?"}}"""
        val encryptedCommand = AndroidTunnelCrypto.encryptFrame(
            sessionKey = sessionKey,
            metadata = TunnelFrameMetadata(
                sessionId = "paired-session",
                sequence = 1,
                expiresAt = expiresAt,
            ),
            plaintext = command,
        )

        val encryptedResult = processor.process(encryptedCommand)
        val result = Json.parseToJsonElement(
            AndroidTunnelCrypto.decryptFrame(sessionKey, encryptedResult),
        ).jsonObject

        assertEquals("8d9dc177-1966-4e4f-948a-e7562f8596d7", result.getValue("requestId").jsonPrimitive.content)
        assertEquals("SearchKnowledge", result.getValue("type").jsonPrimitive.content)
        assertEquals("v1", result.getValue("contractVersion").jsonPrimitive.content)
        assertEquals("SUCCESS", result.getValue("status").jsonPrimitive.content)
        assertEquals(
            listOf("conversation-1-turn-4", "upload-1-page-2"),
            result.getValue("data").jsonObject
                .getValue("resultRefs").jsonArray
                .map { it.jsonPrimitive.content },
        )
        assertEquals("paired-session", encryptedResult.sessionId)
        assertEquals(1L, encryptedResult.sequence)
    }
}
