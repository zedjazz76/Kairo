package kairo.application

import java.time.Instant
import kairo.domain.KnowledgeScope
import kairo.domain.AnchorLocator
import kairo.domain.SourceAnchor
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.ingestion.ArtifactFormat
import kairo.ingestion.ExtractedArtifact
import kairo.ingestion.IngestedArtifact
import kairo.ingestion.IngestionArtifact
import kairo.retrieval.EvidenceMemoryKind
import kairo.retrieval.EvidenceMemoryRecord
import kairo.retrieval.RetrievalQuery
import kotlinx.coroutines.test.runTest
import kairo.security.SensitiveContentDecision
import kairo.security.SensitiveContentMatch
import kairo.security.SensitiveContentKind
import kairo.security.SensitiveContentScan
import kairo.security.StorageDisposition
import kotlin.test.Test
import kotlin.test.assertEquals

class ConversationContinuityServiceTest {

    @Test
    fun `safe uploaded extraction is remembered while unredacted sensitive text is excluded`() = runTest {
        val store = InMemoryEvidenceMemoryStore()
        val service = ConversationContinuityService(store)

        service.rememberUploadArtifacts(
            artifacts = listOf(
                ingestedArtifact(
                    sourceId = "upload-safe",
                    text = "PACS forwards breast studies to MagView for interpretation.",
                    decision = SensitiveContentDecision(
                        scan = SensitiveContentScan(emptyList()),
                        disposition = StorageDisposition.Durable,
                        requiresRedactedDerivative = false,
                        mayEnterDurableVault = true,
                        mayEnterEmbeddingQueue = true,
                        mayEnterBackupOrArchive = true,
                        mayEnterExternalReasoning = true,
                    ),
                ),
                ingestedArtifact(
                    sourceId = "upload-sensitive",
                    text = "MRN 123456 had missing images.",
                    decision = SensitiveContentDecision(
                        scan = SensitiveContentScan(
                            listOf(SensitiveContentMatch(SensitiveContentKind.MRN, 0, 10)),
                        ),
                        disposition = StorageDisposition.TemporaryOnly,
                        requiresRedactedDerivative = false,
                        mayEnterDurableVault = false,
                        mayEnterEmbeddingQueue = false,
                        mayEnterBackupOrArchive = false,
                        mayEnterExternalReasoning = false,
                    ),
                ),
            ),
            capturedAt = Instant.parse("2026-08-29T14:05:00Z"),
        )

        assertEquals(listOf("upload-safe-upload-safe-v1"), store.all().map { it.id })
        assertEquals(
            listOf("PACS forwards breast studies to MagView for interpretation."),
            store.all().map { it.text },
        )
        assertEquals(setOf(EvidenceMemoryKind.UPLOAD), store.all().map { it.kind }.toSet())
    }

    @Test
    fun `chat and upload evidence remain searchable after service recreation`() = runTest {
        val store = InMemoryEvidenceMemoryStore()
        val firstSession = ConversationContinuityService(store)

        firstSession.rememberConversationTurn(
            conversationId = "conversation-1",
            turnNumber = 3,
            text = "MagView delivery stopped because the PACS routing destination was wrong.",
            capturedAt = Instant.parse("2026-08-29T14:00:00Z"),
        )
        firstSession.rememberUploadExcerpt(
            sourceId = "upload-1",
            excerptId = "page-2",
            text = "The breast workflow confirms PACS forwards studies to MagView for interpretation.",
            capturedAt = Instant.parse("2026-08-29T14:05:00Z"),
        )

        val reopenedSession = ConversationContinuityService(store)
        val result = reopenedSession.retrieve(
            RetrievalQuery(
                text = "What did we learn when breast images disappeared from the viewer?",
                scope = KnowledgeScope.MANA_PRODUCTION,
            ),
            facts = emptyList(),
        )

        assertEquals(emptyList(), result.rankedClaims)
        assertEquals(
            setOf(EvidenceMemoryKind.CONVERSATION, EvidenceMemoryKind.UPLOAD),
            result.sources.mapNotNull { it.kind }.toSet(),
        )
    }

    private fun ingestedArtifact(
        sourceId: String,
        text: String,
        decision: SensitiveContentDecision,
    ): IngestedArtifact {
        val source = SourceId(sourceId)
        val variant = SourceVariantId("$sourceId-v1")
        val artifact = IngestionArtifact(
            sourceId = source,
            variantId = variant,
            fileName = "$sourceId.txt",
            bytes = text.encodeToByteArray(),
        )

        return IngestedArtifact(
            extracted = ExtractedArtifact(
                artifact = artifact,
                format = ArtifactFormat.TEXT,
                text = text,
                anchors = setOf(
                    SourceAnchor(source, variant, AnchorLocator.TextSpan(0, text.length)),
                ),
            ),
            sensitiveDecision = decision,
        )
    }
}
