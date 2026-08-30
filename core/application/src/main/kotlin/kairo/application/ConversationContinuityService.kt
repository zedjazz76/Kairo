package kairo.application

import java.time.Instant
import java.util.LinkedHashMap
import kairo.domain.FactVersion
import kairo.ingestion.IngestedArtifact
import kairo.retrieval.EvidenceBundle
import kairo.retrieval.EvidenceMemoryKind
import kairo.retrieval.EvidenceMemoryRecord
import kairo.retrieval.HybridRetriever
import kairo.retrieval.RetrievalQuery

interface EvidenceMemoryStore {
    suspend fun save(record: EvidenceMemoryRecord)

    suspend fun all(): List<EvidenceMemoryRecord>
}

class InMemoryEvidenceMemoryStore : EvidenceMemoryStore {
    private val records = LinkedHashMap<String, EvidenceMemoryRecord>()

    override suspend fun save(record: EvidenceMemoryRecord) {
        records[record.id] = record
    }

    override suspend fun all(): List<EvidenceMemoryRecord> = records.values.toList()
}

class ConversationContinuityService(
    private val store: EvidenceMemoryStore,
) {
    suspend fun rememberConversationTurn(
        conversationId: String,
        turnNumber: Int,
        text: String,
        capturedAt: Instant = Instant.now(),
    ) {
        store.save(
            EvidenceMemoryRecord(
                id = "$conversationId-turn-$turnNumber",
                sourceId = conversationId,
                kind = EvidenceMemoryKind.CONVERSATION,
                text = text,
                capturedAt = capturedAt,
                conversationId = conversationId,
                turnNumber = turnNumber,
            ),
        )
    }

    suspend fun rememberUploadExcerpt(
        sourceId: String,
        excerptId: String,
        text: String,
        capturedAt: Instant = Instant.now(),
    ) {
        require(excerptId.isNotBlank()) { "Upload excerpt id must not be blank" }
        store.save(
            EvidenceMemoryRecord(
                id = "$sourceId-$excerptId",
                sourceId = sourceId,
                kind = EvidenceMemoryKind.UPLOAD,
                text = text,
                capturedAt = capturedAt,
            ),
        )
    }

    suspend fun rememberUploadArtifacts(
        artifacts: List<IngestedArtifact>,
        capturedAt: Instant = Instant.now(),
    ) {
        artifacts
            .filter { artifact ->
                artifact.sensitiveDecision.mayEnterDurableVault &&
                    !artifact.sensitiveDecision.scan.hasSensitiveContent &&
                    artifact.extracted.text.isNotBlank()
            }
            .forEach { artifact ->
                rememberUploadExcerpt(
                    sourceId = artifact.extracted.artifact.sourceId.value,
                    excerptId = artifact.extracted.artifact.variantId.value,
                    text = artifact.extracted.text,
                    capturedAt = capturedAt,
                )
            }
    }

    suspend fun retrieve(
        query: RetrievalQuery,
        facts: List<FactVersion>,
    ): EvidenceBundle =
        HybridRetriever(
            facts = facts,
            evidenceMemory = store.all(),
        ).retrieve(query)
}
