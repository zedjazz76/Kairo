package kairo.ingestion

import java.security.MessageDigest
import java.time.Instant
import kairo.domain.EvidenceState
import kairo.domain.KnowledgeScope
import kairo.domain.Source
import kairo.domain.SourceAuthority
import kairo.security.SensitiveContentKind
import kairo.security.SensitiveContentMatch
import kairo.security.SensitiveContentScan
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class GenesisImporterTest {
    private val loader = GenesisManifestLoader()

    @Test
    fun `valid manifest entry is accepted`() {
        val manifest = loader.load(manifest(validEntry()))

        assertEquals("genesis-corpus-manifest/v1", manifest.schemaVersion)
        assertEquals("synthetic-merge-pacs", manifest.entries.single().id)
    }

    @Test
    fun `manifest rejects missing SHA-256 authority or expected scope`() {
        assertManifestRejected(manifest(validEntry().replace("\"contentHash\": \"${"a".repeat(64)}\",\n", "")), "contentHash")
        assertManifestRejected(manifest(validEntry().replace("\"authority\": \"MANA_INTERNAL_DOCUMENTATION\",\n", "")), "authority")
        assertManifestRejected(manifest(validEntry().replace("\"expectedScope\": \"MANA_PRODUCTION\",\n", "")), "expectedScope")
    }

    @Test
    fun `manifest rejects unsafe or unknown classifications`() {
        assertManifestRejected(
            validEntry().replace("CLEARED_FOR_DURABLE_IMPORT", "TEMPORARY_ONLY"),
            "sensitivityDisposition",
        )
        assertManifestRejected(
            validEntry().replace("\"sourceType\": \"TEXT\"", "\"sourceType\": \"UNKNOWN\""),
            "sourceType",
        )
    }

    @Test
    fun `manifest rejects duplicate stable identities`() {
        assertManifestRejected(manifest(validEntry(), validEntry()), "duplicate")
    }

    @Test
    fun `raw ChatGPT statements remain review-gated proposed candidates`() {
        val payload = "Assistant: MANA should use a new routing rule."
        val sources = mutableListOf<Source>()
        val candidates = mutableListOf<MemoryCandidateDraft>()
        val importer = importer(
            payloads = mapOf("synthetic://chat-history" to payload),
            sources = sources,
            candidates = candidates,
        )

        val result = importer.import(
            loader.load(
                manifest(
                    validEntry(
                        id = "synthetic-chat-history",
                        sourceReference = "synthetic://chat-history",
                        contentHash = sha256(payload),
                        sourceType = "CHAT_TRANSCRIPT",
                        authority = "RAW_CONVERSATION",
                        expectedScope = "MANA_PRODUCTION",
                        expectedEvidenceState = "PROPOSED",
                        materialKind = "RAW_CONVERSATION",
                    ),
                ),
            ),
        )

        assertEquals(IngestionStage.COMPLETE, result.entries.single().stage)
        assertEquals(1, candidates.size)
        assertEquals(EvidenceState.PROPOSED, candidates.single().proposedState)
        assertEquals(KnowledgeScope.MANA_PRODUCTION, candidates.single().proposedScope)
        assertTrue(candidates.single().evidenceAnchors.all { it.sourceId.value == "synthetic-chat-history" })
        assertEquals(SourceAuthority.RAW_CONVERSATION, sources.single().authority)
    }

    @Test
    fun `vendor product material remains PRODUCT knowledge with provenance`() {
        val payload = "Synthetic vendor capability description."
        val sources = mutableListOf<Source>()
        val candidates = mutableListOf<MemoryCandidateDraft>()
        val importer = importer(
            payloads = mapOf("synthetic://vendor-manual" to payload),
            sources = sources,
            candidates = candidates,
        )

        importer.import(
            loader.load(
                manifest(
                    validEntry(
                        id = "synthetic-vendor-manual",
                        sourceReference = "synthetic://vendor-manual",
                        contentHash = sha256(payload),
                        authority = "OFFICIAL_VENDOR_DOCUMENTATION",
                        expectedScope = "PRODUCT",
                        expectedEvidenceState = "OBSERVED",
                        materialKind = "VENDOR_DOCUMENTATION",
                    ),
                ),
            ),
        )

        assertEquals(KnowledgeScope.PRODUCT, candidates.single().proposedScope)
        assertEquals("synthetic-vendor-manual", candidates.single().evidenceAnchors.single().sourceId.value)
        assertEquals(kairo.domain.SourceClassification.INTERNAL, sources.single().classification)
    }

    @Test
    fun `planned project material retains planned scope and cannot become current production by import`() {
        val payload = "Synthetic project transition discussion."
        val candidates = mutableListOf<MemoryCandidateDraft>()
        val importer = importer(
            payloads = mapOf("synthetic://project-transition" to payload),
            candidates = candidates,
        )

        importer.import(
            loader.load(
                manifest(
                    validEntry(
                        id = "synthetic-project-transition",
                        sourceReference = "synthetic://project-transition",
                        contentHash = sha256(payload),
                        expectedScope = "PROJECT",
                        expectedEvidenceState = "PLANNED",
                        temporalDisposition = "PLANNED",
                        projectIds = listOf("synthetic-abbadox-transition"),
                        materialKind = "CURATED_MANA_KNOWLEDGE",
                    ),
                ),
            ),
        )

        assertEquals(KnowledgeScope.PROJECT, candidates.single().proposedScope)
        assertEquals(EvidenceState.PLANNED, candidates.single().proposedState)
    }

    @Test
    fun `sensitive source is held at existing policy boundary rather than imported`() {
        val payload = "Synthetic sensitive-looking payload"
        val sources = mutableListOf<Source>()
        val candidates = mutableListOf<MemoryCandidateDraft>()
        val importer = importer(
            payloads = mapOf("synthetic://sensitive" to payload),
            sources = sources,
            candidates = candidates,
            scanner = {
                SensitiveContentScan(
                    listOf(SensitiveContentMatch(SensitiveContentKind.MRN, 0, 4)),
                )
            },
        )

        val result = importer.import(
            loader.load(
                manifest(
                    validEntry(
                        id = "synthetic-sensitive",
                        sourceReference = "synthetic://sensitive",
                        contentHash = sha256(payload),
                    ),
                ),
            ),
        )

        assertEquals(IngestionStage.PHI_REVIEW_REQUIRED, result.entries.single().stage)
        assertTrue(sources.isEmpty())
        assertTrue(candidates.isEmpty())
    }

    private fun importer(
        payloads: Map<String, String>,
        sources: MutableList<Source> = mutableListOf(),
        candidates: MutableList<MemoryCandidateDraft> = mutableListOf(),
        scanner: (String) -> SensitiveContentScan = { SensitiveContentScan(emptyList()) },
    ): GenesisImporter = GenesisImporter(
        pipeline = IngestionPipeline(
            extractors = listOf(GenesisPlainTextExtractor()),
            scanner = scanner,
        ),
        payloadResolver = GenesisPayloadResolver { entry ->
            payloads[entry.sourceReference]?.let { text ->
                GenesisSourcePayload(
                    fileName = "${entry.id}.txt",
                    bytes = text.encodeToByteArray(),
                    mediaType = "text/plain",
                )
            }
        },
        sourceRecorder = GenesisSourceRecorder { source -> sources.add(source); Unit },
        candidateReceiver = GenesisCandidateReceiver { candidate -> candidates.add(candidate); Unit },
        now = { Instant.parse("2026-08-24T12:00:00Z") },
    )

    private fun assertManifestRejected(json: String, expectedMessage: String) {
        val failure = assertFailsWith<IllegalArgumentException> { loader.load(json) }
        assertTrue(failure.message.orEmpty().contains(expectedMessage, ignoreCase = true))
    }

    private fun manifest(vararg entries: String): String =
        """
        {
          "schemaVersion": "genesis-corpus-manifest/v1",
          "corpusStatus": "READY",
          "requiredDomainCoverage": ["Synthetic Domain"],
          "entries": [${entries.joinToString(",")}]
        }
        """.trimIndent()

    private fun validEntry(
        id: String = "synthetic-merge-pacs",
        sourceReference: String = "synthetic://merge-pacs",
        contentHash: String = "a".repeat(64),
        sourceType: String = "TEXT",
        authority: String = "MANA_INTERNAL_DOCUMENTATION",
        expectedScope: String = "MANA_PRODUCTION",
        expectedEvidenceState: String = "OBSERVED",
        temporalDisposition: String = "CURRENT",
        materialKind: String = "CURATED_MANA_KNOWLEDGE",
        projectIds: List<String> = emptyList(),
    ): String =
        """
        {
          "id": "$id",
          "sourceReference": "$sourceReference",
          "contentHash": "$contentHash",
          "sourceType": "$sourceType",
          "sourceClassification": "INTERNAL",
          "authority": "$authority",
          "expectedScope": "$expectedScope",
          "expectedEvidenceState": "$expectedEvidenceState",
          "temporalDisposition": "$temporalDisposition",
          "sensitivityDisposition": "CLEARED_FOR_DURABLE_IMPORT",
          "materialKind": "$materialKind",
          "domains": ["Synthetic Domain"],
          "projectIds": [${projectIds.joinToString(",") { "\"$it\"" }}]
        }
        """.trimIndent()

    private fun sha256(value: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(value.encodeToByteArray())
            .joinToString("") { byte -> "%02x".format(byte) }
}

private class GenesisPlainTextExtractor : ArtifactExtractor {
    override fun supports(format: ArtifactFormat): Boolean = true

    override fun extract(artifact: IngestionArtifact, format: ArtifactFormat): ExtractedArtifact {
        val text = artifact.bytes.decodeToString()
        return ExtractedArtifact(
            artifact = artifact,
            format = format,
            text = text,
            anchors = setOf(
                kairo.domain.SourceAnchor(
                    artifact.sourceId,
                    artifact.variantId,
                    kairo.domain.AnchorLocator.TextSpan(0, text.length),
                ),
            ),
        )
    }
}
