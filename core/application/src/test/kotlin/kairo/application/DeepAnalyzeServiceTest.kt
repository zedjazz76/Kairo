package kairo.application

import kairo.domain.AnchorLocator
import kairo.domain.EvidenceState
import kairo.domain.IncidentPattern
import kairo.domain.IncidentPatternId
import kairo.domain.KnowledgeScope
import kairo.domain.SourceAnchor
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.domain.WorkflowId
import java.time.Instant
import kairo.domain.Workflow
import kairo.domain.WorkflowState
import kairo.domain.WorkflowStep
import kairo.domain.WorkflowStepId
import kairo.retrieval.HybridRetriever
import kotlin.test.Test
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class DeepAnalyzeServiceTest {

    @Test
    fun `deep analysis ranks a failure domain and next verification`() {
        val anchor = SourceAnchor(
            sourceId = SourceId("incident-source"),
            variantId = SourceVariantId("incident-variant"),
            locator = AnchorLocator.TextSpan(
                startOffset = 0,
                endOffset = 20,
            ),
        )

        val incident = IncidentPattern(
            id = IncidentPatternId("magview-routing"),
            symptom = "Breast studies are not reaching MagView.",
            affectedWorkflow = WorkflowId("breast-imaging"),
            rootCause = "Routing path failure",
            resolution = "Validate routing destination and downstream receipt.",
            prevention = "Monitor routing and receipt.",
            scope = KnowledgeScope.INCIDENT,
            evidenceState = EvidenceState.OBSERVED,
            evidenceAnchors = setOf(anchor),
        )

        val service = DeepAnalyzeService(
            retriever = HybridRetriever(
                facts = emptyList(),
                incidents = listOf(incident),
            ),
        )

        val result = service.deepAnalyze(
            "Why are studies not reaching MagView?",
        )

        assertTrue(
            result.failureDomains.isNotEmpty(),
        )

        assertNotNull(
            result.nextBestAction,
        )

        assertTrue(
            result.claims.all { claim ->
                claim.evidenceRefs.isNotEmpty() ||
                    claim.state == EvidenceState.HYPOTHESIS
            },
        )
    }
    @Test
    fun `deep analysis recommends verification at matching workflow hop`() {
        val workflow = Workflow(
            id = WorkflowId("breast-imaging"),
            name = "Breast Imaging",
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = WorkflowState.CURRENT,
            evidenceState = EvidenceState.PLANNED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt =
                Instant.parse("2026-08-22T10:00:00Z"),
            steps = listOf(
                WorkflowStep(
                    id = WorkflowStepId("pacs"),
                    name = "PACS routing",
                    system = "Merge PACS",
                    evidenceState = EvidenceState.PLANNED,
                ),
                WorkflowStep(
                    id = WorkflowStepId("magview"),
                    name = "Breast destination",
                    system = "MagView",
                    evidenceState = EvidenceState.PLANNED,
                ),
            ),
            evidenceAnchors = emptySet(),
        )

        val traceService = TraceWorkflowService(
            productionWorkflows = listOf(workflow),
            projects = emptyList(),
        )

        val service = DeepAnalyzeService(
            retriever = HybridRetriever(
                facts = emptyList(),
            ),
            traceWorkflowService = traceService,
            workflowId = workflow.id,
        )

        val result = service.deepAnalyze(
            "Why are studies not reaching MagView?",
        )

        assertTrue(
            result.nextBestAction
                ?.contains("MagView", ignoreCase = true)
                == true,
        )
    }


    @Test
    fun `incident and trace agreement boosts matching failure domain`() {
        val anchor = SourceAnchor(
            sourceId = SourceId("routing-source"),
            variantId = SourceVariantId("routing-variant"),
            locator = AnchorLocator.TextSpan(
                startOffset = 0,
                endOffset = 20,
            ),
        )

        val incident = IncidentPattern(
            id = IncidentPatternId("routing-incident"),
            symptom = "Studies are not reaching MagView.",
            affectedWorkflow = WorkflowId("breast-routing"),
            rootCause = "Routing path failure",
            resolution = "Validate PACS routing and MagView receipt.",
            prevention = "Monitor routing destination receipt.",
            scope = KnowledgeScope.INCIDENT,
            evidenceState = EvidenceState.OBSERVED,
            evidenceAnchors = setOf(anchor),
        )

        val workflow = Workflow(
            id = WorkflowId("breast-routing"),
            name = "Breast Routing",
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = WorkflowState.CURRENT,
            evidenceState = EvidenceState.PLANNED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt =
                Instant.parse("2026-08-22T10:00:00Z"),
            steps = listOf(
                WorkflowStep(
                    id = WorkflowStepId("routing-hop"),
                    name = "PACS routing",
                    system = "Merge PACS",
                    evidenceState = EvidenceState.PLANNED,
                ),
                WorkflowStep(
                    id = WorkflowStepId("destination-hop"),
                    name = "Breast destination",
                    system = "MagView",
                    evidenceState = EvidenceState.PLANNED,
                ),
            ),
            evidenceAnchors = emptySet(),
        )

        val service = DeepAnalyzeService(
            retriever = HybridRetriever(
                facts = emptyList(),
                incidents = listOf(incident),
            ),
            traceWorkflowService = TraceWorkflowService(
                productionWorkflows = listOf(workflow),
                projects = emptyList(),
            ),
            workflowId = workflow.id,
        )

        val result = service.deepAnalyze(
            "Why are studies not reaching MagView?",
        )

        assertTrue(
            result.failureDomains.first().name ==
                "WORKLIST_OR_ROUTING" ||
                result.failureDomains.first().name ==
                "ROUTING",
        )

        assertTrue(
            result.failureDomains.first().score > 100,
        )
    }


    @Test
    fun `deep analysis rejects unsupported model enrichment but retains deterministic diagnosis`() =
        kotlinx.coroutines.test.runTest {
            val anchor = SourceAnchor(
                sourceId = SourceId("routing-source-model"),
                variantId = SourceVariantId("routing-variant-model"),
                locator = AnchorLocator.TextSpan(
                    startOffset = 0,
                    endOffset = 20,
                ),
            )

            val incident = IncidentPattern(
                id = IncidentPatternId("routing-model-incident"),
                symptom = "Studies are not reaching MagView.",
                affectedWorkflow = WorkflowId("breast-model-routing"),
                rootCause = "Routing path failure",
                resolution = "Validate PACS routing and downstream receipt.",
                prevention = "Monitor destination receipt.",
                scope = KnowledgeScope.INCIDENT,
                evidenceState = EvidenceState.OBSERVED,
                evidenceAnchors = setOf(anchor),
            )

            val provider = object : ReasoningProvider {
                override suspend fun analyze(
                    packet: ReasoningPacket,
                ): KairoAnswer =
                    KairoAnswer(
                        text = "Merge PACS is definitely sending to an undocumented destination.",
                        claims = listOf(
                            AnswerClaim(
                                text = "Merge PACS is definitely sending to an undocumented destination.",
                                scope = KnowledgeScope.MANA_PRODUCTION,
                                evidenceRefs = setOf(
                                    kairo.domain.EvidenceRef("invented-model-evidence"),
                                ),
                            ),
                        ),
                    )
            }

            val service = DeepAnalyzeService(
                retriever = HybridRetriever(
                    facts = emptyList(),
                    incidents = listOf(incident),
                ),
                reasoningProvider = provider,
                answerValidator = AnswerValidator(),
            )

            val result = service.deepAnalyzeWithReasoning(
                "Why are studies not reaching MagView?",
            )

            assertTrue(
                result.failureDomains.isNotEmpty(),
            )

            assertNotNull(
                result.nextBestAction,
            )

            assertTrue(
                result.modelEnrichment is ValidatedAnswer.Rejected,
            )
        }


    @Test
    fun `deep analysis accepts supported model enrichment and preserves deterministic diagnosis`() =
        kotlinx.coroutines.test.runTest {
            val evidenceRef =
                kairo.domain.EvidenceRef("supported-model-evidence")

            val fact =
                kairo.domain.FactVersion(
                    id = kairo.domain.FactId("supported-model-fact"),
                    subject = kairo.domain.EntityId("merge-pacs"),
                    predicate = "hosts",
                    objectValue =
                        kairo.domain.FactObject.Literal("DMWL"),
                    scope = KnowledgeScope.MANA_PRODUCTION,
                    state = EvidenceState.CONFIRMED,
                    effectiveFrom = null,
                    effectiveTo = null,
                    recordedAt =
                        Instant.parse("2026-08-22T12:00:00Z"),
                    lastValidatedAt =
                        Instant.parse("2026-08-22T12:00:00Z"),
                    evidence = setOf(evidenceRef),
                )

            val provider = object : ReasoningProvider {
                override suspend fun analyze(
                    packet: ReasoningPacket,
                ): KairoAnswer =
                    KairoAnswer(
                        text =
                            "Merge PACS hosts DMWL, so validate the downstream routing path next.",
                        claims = listOf(
                            AnswerClaim(
                                text = "Merge PACS hosts DMWL.",
                                scope = KnowledgeScope.MANA_PRODUCTION,
                                evidenceRefs = setOf(evidenceRef),
                                action = AnswerAction.ADVISORY,
                            ),
                        ),
                    )
            }

            val service =
                DeepAnalyzeService(
                    retriever =
                        HybridRetriever(
                            facts = listOf(fact),
                        ),
                    reasoningProvider = provider,
                    answerValidator = AnswerValidator(),
                    now = {
                        Instant.parse("2026-08-22T13:00:00Z")
                    },
                )

            val result =
                service.deepAnalyzeWithReasoning(
                    "Why might downstream routing fail?",
                )

            assertTrue(
                result.failureDomains.isNotEmpty(),
            )

            assertNotNull(
                result.nextBestAction,
            )

            assertTrue(
                result.modelEnrichment
                    is ValidatedAnswer.Accepted,
            )
        }


    @Test
    fun `Baxter identity result flow ranks identity mismatch first`() {
        val anchor = SourceAnchor(
            sourceId = SourceId("baxter-identity-source"),
            variantId = SourceVariantId("baxter-identity-variant"),
            locator = AnchorLocator.TextSpan(
                startOffset = 0,
                endOffset = 24,
            ),
        )

        val incident = IncidentPattern(
            id = IncidentPatternId("baxter-mrn-mismatch"),
            symptom =
                "Result reaches Baxter but patient identity does not reconcile because the MANA MRN differs from the Baxter MRN.",
            affectedWorkflow = WorkflowId("baxter-result-flow"),
            rootCause = "MRN identity mismatch across result interfaces",
            resolution =
                "Validate the identifier mapping carried through the result flow before changing routing.",
            prevention =
                "Preserve both source-system identifiers and reconcile them explicitly.",
            scope = KnowledgeScope.INCIDENT,
            evidenceState = EvidenceState.OBSERVED,
            evidenceAnchors = setOf(anchor),
        )

        val workflow = Workflow(
            id = WorkflowId("baxter-result-flow"),
            name = "Baxter Result Flow",
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = WorkflowState.CURRENT,
            evidenceState = EvidenceState.PLANNED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt =
                Instant.parse("2026-08-22T10:00:00Z"),
            steps = listOf(
                WorkflowStep(
                    id = WorkflowStepId("mana-result"),
                    name = "Generate result",
                    system = "MANA",
                    evidenceState = EvidenceState.PLANNED,
                ),
                WorkflowStep(
                    id = WorkflowStepId("hl7-result"),
                    name = "HL7 result interface",
                    system = "Interface Engine",
                    evidenceState = EvidenceState.PLANNED,
                ),
                WorkflowStep(
                    id = WorkflowStepId("baxter-receive"),
                    name = "Receive result",
                    system = "Baxter",
                    evidenceState = EvidenceState.PLANNED,
                ),
            ),
            evidenceAnchors = emptySet(),
        )

        val service = DeepAnalyzeService(
            retriever = HybridRetriever(
                facts = emptyList(),
                incidents = listOf(incident),
            ),
            traceWorkflowService = TraceWorkflowService(
                productionWorkflows = listOf(workflow),
                projects = emptyList(),
            ),
            workflowId = workflow.id,
        )

        val result = service.deepAnalyze(
            "Why would a Baxter result arrive but fail patient reconciliation?",
        )

        assertTrue(
            result.failureDomains.first().name ==
                "IDENTITY_OR_DEMOGRAPHICS",
        )

        assertTrue(
            result.nextBestAction
                ?.contains("identifier", ignoreCase = true)
                == true,
        )
    }


}
