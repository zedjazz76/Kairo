package kairo.application

import kairo.domain.EvidenceRef
import kairo.domain.EvidenceState
import kairo.domain.FactId
import kairo.domain.FactObject
import kairo.domain.FactVersion
import kairo.domain.KnowledgeScope
import kairo.domain.EntityId
import kairo.retrieval.EvidenceBundle
import kairo.retrieval.RankedFact
import kairo.retrieval.RetrievalQuery
import kairo.retrieval.HybridRetriever
import kotlinx.coroutines.test.runTest
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AskKairoServiceTest {

    @Test
    fun `simple fact lookup does not require frontier model`() = runTest {
        val fact = FactVersion(
            id = FactId("merge-ris-version"),
            subject = EntityId("merge-ris"),
            predicate = "version",
            objectValue = FactObject.Literal("9.2.2.122"),
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.CONFIRMED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt = Instant.parse("2026-08-22T12:00:00Z"),
            lastValidatedAt = Instant.parse("2026-08-22T12:00:00Z"),
            evidence = setOf(EvidenceRef("source-version")),
        )

        val retriever = HybridRetriever(
            facts = listOf(fact),
        )

        val reasoningProvider = CountingReasoningProvider()

        val service = AskKairoService(
            retriever = retriever,
            reasoningProvider = reasoningProvider,
        )

        val answer = service.quick(
            "What version of Merge RIS do we use?",
        )

        assertEquals(
            "9.2.2.122",
            answer.text,
        )

        assertEquals(
            0,
            reasoningProvider.calls,
        )
    }


    @Test
    fun `unsupported MANA claim is rejected`() {
        val validator = AnswerValidator()

        val answer = KairoAnswer(
            text = "Merge PACS sends reports directly to eClinicalWorks.",
            claims = listOf(
                AnswerClaim(
                    text = "Merge PACS sends reports directly to eClinicalWorks.",
                    scope = KnowledgeScope.MANA_PRODUCTION,
                    evidenceRefs = setOf(
                        EvidenceRef("missing-evidence"),
                    ),
                ),
            ),
        )

        val result = validator.validate(
            answer = answer,
            bundle = EvidenceBundle(
                rankedClaims = emptyList(),
            ),
        )

        assertTrue(
            result is ValidationResult.Rejected,
        )
    }


    @Test
    fun `supported MANA claim is accepted`() {
        val fact = FactVersion(
            id = FactId("supported-fact"),
            subject = EntityId("merge-pacs"),
            predicate = "hosts",
            objectValue = FactObject.Literal("DMWL"),
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.CONFIRMED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt = Instant.parse("2026-08-22T12:00:00Z"),
            lastValidatedAt = Instant.parse("2026-08-22T12:00:00Z"),
            evidence = setOf(
                EvidenceRef("evidence-supported"),
            ),
        )

        val validator = AnswerValidator()

        val answer = KairoAnswer(
            text = "Merge PACS hosts DMWL.",
            claims = listOf(
                AnswerClaim(
                    text = "Merge PACS hosts DMWL.",
                    scope = KnowledgeScope.MANA_PRODUCTION,
                    evidenceRefs = setOf(
                        EvidenceRef("evidence-supported"),
                    ),
                ),
            ),
        )

        val result = validator.validate(
            answer = answer,
            bundle = EvidenceBundle(
                rankedClaims = listOf(
                    RankedFact(
                        fact = fact,
                        score = 100,
                    ),
                ),
            ),
        )

        assertTrue(
            result is ValidationResult.Accepted,
        )
    }


    @Test
    fun `project evidence cannot support MANA production claim`() {
        val fact = FactVersion(
            id = FactId("project-fact"),
            subject = EntityId("abbadox"),
            predicate = "is-ris",
            objectValue = FactObject.Literal("AbbaDox CareFlow"),
            scope = KnowledgeScope.PROJECT,
            state = EvidenceState.PLANNED,
            effectiveFrom = Instant.parse("2026-09-02T00:00:00Z"),
            effectiveTo = null,
            recordedAt = Instant.parse("2026-08-22T12:00:00Z"),
            lastValidatedAt = null,
            evidence = setOf(
                EvidenceRef("evidence-project"),
            ),
        )

        val answer = KairoAnswer(
            text = "MANA production currently uses AbbaDox CareFlow.",
            claims = listOf(
                AnswerClaim(
                    text = "MANA production currently uses AbbaDox CareFlow.",
                    scope = KnowledgeScope.MANA_PRODUCTION,
                    evidenceRefs = setOf(
                        EvidenceRef("evidence-project"),
                    ),
                ),
            ),
        )

        val result = AnswerValidator().validate(
            answer = answer,
            bundle = EvidenceBundle(
                rankedClaims = listOf(
                    RankedFact(
                        fact = fact,
                        score = 100,
                    ),
                ),
            ),
        )

        assertTrue(
            result is ValidationResult.Rejected,
        )
    }


    @Test
    fun `expired production evidence cannot support current claim`() {
        val fact = FactVersion(
            id = FactId("expired-production-fact"),
            subject = EntityId("merge-ris"),
            predicate = "is-current-ris",
            objectValue = FactObject.Literal("Merge RIS"),
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.CONFIRMED,
            effectiveFrom = Instant.parse("2025-01-01T00:00:00Z"),
            effectiveTo = Instant.parse("2026-09-01T23:59:59Z"),
            recordedAt = Instant.parse("2026-01-01T00:00:00Z"),
            lastValidatedAt = Instant.parse("2026-08-01T00:00:00Z"),
            evidence = setOf(
                EvidenceRef("evidence-expired"),
            ),
        )

        val answer = KairoAnswer(
            text = "MANA currently uses Merge RIS for non-breast imaging.",
            claims = listOf(
                AnswerClaim(
                    text = "MANA currently uses Merge RIS for non-breast imaging.",
                    scope = KnowledgeScope.MANA_PRODUCTION,
                    evidenceRefs = setOf(
                        EvidenceRef("evidence-expired"),
                    ),
                ),
            ),
        )

        val result = AnswerValidator().validate(
            answer = answer,
            bundle = EvidenceBundle(
                rankedClaims = listOf(
                    RankedFact(
                        fact = fact,
                        score = 100,
                    ),
                ),
            ),
            at = Instant.parse("2026-09-03T12:00:00Z"),
        )

        assertTrue(
            result is ValidationResult.Rejected,
        )
    }


    @Test
    fun `contradicted evidence cannot support current production claim`() {
        val fact = FactVersion(
            id = FactId("contradicted-production-fact"),
            subject = EntityId("merge-pacs"),
            predicate = "routes-to",
            objectValue = FactObject.Literal("Legacy destination"),
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.CONTRADICTED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt = Instant.parse("2026-08-22T12:00:00Z"),
            lastValidatedAt = Instant.parse("2026-08-22T12:00:00Z"),
            evidence = setOf(
                EvidenceRef("evidence-contradicted"),
            ),
        )

        val answer = KairoAnswer(
            text = "Merge PACS currently routes to the legacy destination.",
            claims = listOf(
                AnswerClaim(
                    text = "Merge PACS currently routes to the legacy destination.",
                    scope = KnowledgeScope.MANA_PRODUCTION,
                    evidenceRefs = setOf(
                        EvidenceRef("evidence-contradicted"),
                    ),
                ),
            ),
        )

        val result = AnswerValidator().validate(
            answer = answer,
            bundle = EvidenceBundle(
                rankedClaims = listOf(
                    RankedFact(
                        fact = fact,
                        score = 100,
                    ),
                ),
            ),
            at = Instant.parse("2026-08-22T13:00:00Z"),
        )

        assertTrue(
            result is ValidationResult.Rejected,
        )
    }


    @Test
    fun `unknown MANA fact returns unknown without frontier reasoning`() = runTest {
        val retriever = HybridRetriever(
            facts = emptyList(),
        )

        val reasoningProvider = CountingReasoningProvider()

        val service = AskKairoService(
            retriever = retriever,
            reasoningProvider = reasoningProvider,
        )

        val answer = service.quick(
            "What production server hosts the cardiology archive?",
        )

        assertEquals(
            "I don't know from the available MANA evidence.",
            answer.text,
        )

        assertEquals(
            0,
            reasoningProvider.calls,
        )
    }


    @Test
    fun `analyze rejects unsupported model answer`() = runTest {
        val retriever = HybridRetriever(
            facts = emptyList(),
        )

        val provider = object : ReasoningProvider {
            override suspend fun analyze(
                packet: ReasoningPacket,
            ): KairoAnswer =
                KairoAnswer(
                    text = "Merge PACS sends results directly to eClinicalWorks.",
                    claims = listOf(
                        AnswerClaim(
                            text = "Merge PACS sends results directly to eClinicalWorks.",
                            scope = KnowledgeScope.MANA_PRODUCTION,
                            evidenceRefs = setOf(
                                EvidenceRef("invented-evidence"),
                            ),
                        ),
                    ),
                )
        }

        val service = AskKairoService(
            retriever = retriever,
            reasoningProvider = provider,
        )

        val result = service.analyze(
            "How do results reach eClinicalWorks?",
        )

        assertTrue(
            result is ValidatedAnswer.Rejected,
        )
    }


    @Test
    fun `analyze accepts supported model answer`() = runTest {
        val fact = FactVersion(
            id = FactId("supported-analyze-fact"),
            subject = EntityId("merge-pacs"),
            predicate = "hosts",
            objectValue = FactObject.Literal("DMWL"),
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.CONFIRMED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt = Instant.parse("2026-08-22T12:00:00Z"),
            lastValidatedAt = Instant.parse("2026-08-22T12:00:00Z"),
            evidence = setOf(
                EvidenceRef("analyze-supported-evidence"),
            ),
        )

        val retriever = HybridRetriever(
            facts = listOf(fact),
        )

        val provider = object : ReasoningProvider {
            override suspend fun analyze(
                packet: ReasoningPacket,
            ): KairoAnswer =
                KairoAnswer(
                    text = "Merge PACS hosts DMWL.",
                    claims = listOf(
                        AnswerClaim(
                            text = "Merge PACS hosts DMWL.",
                            scope = KnowledgeScope.MANA_PRODUCTION,
                            evidenceRefs = setOf(
                                EvidenceRef("analyze-supported-evidence"),
                            ),
                        ),
                    ),
                )
        }

        val service = AskKairoService(
            retriever = retriever,
            reasoningProvider = provider,
            now = {
                Instant.parse("2026-08-22T13:00:00Z")
            },
        )

        val result = service.analyze(
            "Who hosts DMWL?",
        )

        assertTrue(
            result is ValidatedAnswer.Accepted,
        )

        val accepted =
            result as ValidatedAnswer.Accepted

        assertEquals(
            "Merge PACS hosts DMWL.",
            accepted.answer.text,
        )
    }


    @Test
    fun `analyze reasoning packet separates evidence states and unknowns`() = runTest {
        val confirmed = FactVersion(
            id = FactId("confirmed-fact"),
            subject = EntityId("merge-pacs"),
            predicate = "hosts",
            objectValue = FactObject.Literal("DMWL"),
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.CONFIRMED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt = Instant.parse("2026-08-22T12:00:00Z"),
            lastValidatedAt = Instant.parse("2026-08-22T12:00:00Z"),
            evidence = setOf(EvidenceRef("confirmed-evidence")),
        )

        val planned = FactVersion(
            id = FactId("planned-fact"),
            subject = EntityId("abbadox"),
            predicate = "future-ris",
            objectValue = FactObject.Literal("AbbaDox CareFlow"),
            scope = KnowledgeScope.PROJECT,
            state = EvidenceState.PLANNED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt = Instant.parse("2026-08-22T12:00:00Z"),
            lastValidatedAt = null,
            evidence = setOf(EvidenceRef("planned-evidence")),
        )

        var capturedPacket: ReasoningPacket? = null

        val provider = object : ReasoningProvider {
            override suspend fun analyze(
                packet: ReasoningPacket,
            ): KairoAnswer {
                capturedPacket = packet

                return KairoAnswer(
                    text = "No asserted claims.",
                )
            }
        }

        val retriever = HybridRetriever(
            facts = listOf(
                confirmed,
                planned,
            ),
        )

        val service = AskKairoService(
            retriever = retriever,
            reasoningProvider = provider,
        )

        service.analyze(
            "Explain the current and planned RIS state.",
        )

        val packet = requireNotNull(capturedPacket)

        assertTrue(
            packet.confirmed.any {
                it.fact.id == confirmed.id
            },
        )

        assertTrue(
            packet.planned.any {
                it.fact.id == planned.id
            },
        )

        assertTrue(packet.prohibitedActions.isNotEmpty())
    }


    @Test
    fun `temporary sensitive content blocks model reasoning`() = runTest {
        val provider = CountingReasoningProvider()

        val service = AskKairoService(
            retriever = HybridRetriever(
                facts = emptyList(),
            ),
            reasoningProvider = provider,
            sensitiveContentGuard = SensitiveContentGuard { question ->
                if (question.contains("MRN", ignoreCase = true)) {
                    SensitiveContentDecision.BLOCK_CLOUD_REASONING
                } else {
                    SensitiveContentDecision.ALLOW
                }
            },
        )

        val result = service.analyze(
            "Troubleshoot MRN 123456 routing.",
        )

        assertTrue(
            result is ValidatedAnswer.Rejected,
        )

        assertEquals(
            0,
            provider.calls,
        )
    }


    @Test
    fun `production write recommendation is rejected`() {
        val fact = FactVersion(
            id = FactId("supported-write-fact"),
            subject = EntityId("merge-pacs"),
            predicate = "hosts",
            objectValue = FactObject.Literal("DMWL"),
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.CONFIRMED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt = Instant.parse("2026-08-22T12:00:00Z"),
            lastValidatedAt = Instant.parse("2026-08-22T12:00:00Z"),
            evidence = setOf(
                EvidenceRef("write-evidence"),
            ),
        )

        val answer = KairoAnswer(
            text = "Change the production Merge PACS DMWL configuration.",
            claims = listOf(
                AnswerClaim(
                    text = "Change the production Merge PACS DMWL configuration.",
                    scope = KnowledgeScope.MANA_PRODUCTION,
                    evidenceRefs = setOf(
                        EvidenceRef("write-evidence"),
                    ),
                    action = AnswerAction.PRODUCTION_WRITE,
                ),
            ),
        )

        val result = AnswerValidator().validate(
            answer = answer,
            bundle = EvidenceBundle(
                rankedClaims = listOf(
                    RankedFact(
                        fact = fact,
                        score = 100,
                    ),
                ),
            ),
        )

        assertTrue(
            result is ValidationResult.Rejected,
        )
    }


    @Test
    fun `product capability cannot support MANA production claim`() {
        val fact = FactVersion(
            id = FactId("product-capability"),
            subject = EntityId("vendor-product"),
            predicate = "supports",
            objectValue = FactObject.Literal("DICOM SR"),
            scope = KnowledgeScope.PRODUCT,
            state = EvidenceState.CONFIRMED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt = Instant.parse("2026-08-22T12:00:00Z"),
            lastValidatedAt = Instant.parse("2026-08-22T12:00:00Z"),
            evidence = setOf(
                EvidenceRef("product-evidence"),
            ),
        )

        val answer = KairoAnswer(
            text = "Our production system sends DICOM SR.",
            claims = listOf(
                AnswerClaim(
                    text = "Our production system sends DICOM SR.",
                    scope = KnowledgeScope.MANA_PRODUCTION,
                    evidenceRefs = setOf(
                        EvidenceRef("product-evidence"),
                    ),
                ),
            ),
        )

        val result = AnswerValidator().validate(
            answer = answer,
            bundle = EvidenceBundle(
                rankedClaims = listOf(
                    RankedFact(
                        fact = fact,
                        score = 100,
                    ),
                ),
            ),
        )

        assertTrue(
            result is ValidationResult.Rejected,
        )
    }

    private class CountingReasoningProvider : ReasoningProvider {
        var calls = 0

        override suspend fun analyze(
            packet: ReasoningPacket,
        ): KairoAnswer {
            calls += 1
            error("Frontier reasoning should not be used for simple lookup")
        }
    }
}
