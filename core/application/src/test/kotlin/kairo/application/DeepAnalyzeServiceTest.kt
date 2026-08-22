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


}
