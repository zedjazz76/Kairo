package kairo.application

import java.time.Instant
import kairo.domain.EvidenceState
import kairo.domain.KnowledgeScope
import kairo.domain.Project
import kairo.domain.ProjectId
import kairo.domain.ProjectStatus
import kairo.domain.ProjectTimeline
import kairo.domain.AnchorLocator
import kairo.domain.SourceAnchor
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.domain.Workflow
import kairo.domain.WorkflowId
import kairo.domain.WorkflowState
import kairo.domain.WorkflowStep
import kairo.domain.WorkflowStepId
import kotlin.test.Test
import kotlin.test.assertTrue

class TraceWorkflowServiceTest {

    @Test
    fun `trace distinguishes current from AbbaDox future state`() {
        val current = workflow(
            id = "current-non-breast",
            name = "Current Non-Breast RIS",
            state = WorkflowState.CURRENT,
            system = "Merge RIS",
            scope = KnowledgeScope.MANA_PRODUCTION,
            evidenceState = EvidenceState.PLANNED,
            effectiveFrom = null,
        )

        val future = workflow(
            id = "future-non-breast",
            name = "Future Non-Breast RIS",
            state = WorkflowState.FUTURE,
            system = "AbbaDox CareFlow",
            scope = KnowledgeScope.PROJECT,
            evidenceState = EvidenceState.PLANNED,
            effectiveFrom =
                Instant.parse("2026-09-02T00:00:00Z"),
        )

        val project = Project(
            id = ProjectId("ris-transition"),
            name = "RIS Transition",
            objective = "Transition non-breast imaging RIS.",
            status = ProjectStatus.IMPLEMENTATION,
            timeline = ProjectTimeline(
                startsAt = null,
                endsAt = null,
            ),
            futureArchitecture = listOf(future),
        )

        val service = TraceWorkflowService(
            productionWorkflows = listOf(current),
            projects = listOf(project),
        )

        val trace = service.trace(
            workflowId = WorkflowId("current-non-breast"),
            atTime =
                Instant.parse("2026-08-22T12:00:00Z"),
            knowledgeAsOf =
                Instant.parse("2026-08-22T12:00:00Z"),
        )

        assertTrue(
            trace.current.steps.any {
                it.system == "Merge RIS"
            },
        )

        assertTrue(
            trace.future.steps.any {
                it.system == "AbbaDox CareFlow"
            },
        )

        assertTrue(
            trace.future.annotations.contains(
                "Breast remains on Merge RIS through approximately February 2027 (planned)",
            ),
        )
    }


    @Test
    fun `trace does not reveal future workflow before it was known`() {
        val current = workflow(
            id = "current-ris",
            name = "Current RIS",
            state = WorkflowState.CURRENT,
            system = "Merge RIS",
            scope = KnowledgeScope.MANA_PRODUCTION,
            evidenceState = EvidenceState.PLANNED,
            effectiveFrom = null,
        )

        val laterKnownFuture = Workflow(
            id = WorkflowId("later-known-future"),
            name = "Later Known Future RIS",
            scope = KnowledgeScope.PROJECT,
            state = WorkflowState.FUTURE,
            evidenceState = EvidenceState.PLANNED,
            effectiveFrom =
                Instant.parse("2026-09-02T00:00:00Z"),
            effectiveTo = null,
            recordedAt =
                Instant.parse("2026-08-25T12:00:00Z"),
            steps = listOf(
                WorkflowStep(
                    id = WorkflowStepId("future-step"),
                    name = "RIS",
                    system = "AbbaDox CareFlow",
                    evidenceState = EvidenceState.PLANNED,
                ),
            ),
            evidenceAnchors = emptySet(),
        )

        val project = Project(
            id = ProjectId("ris-transition-later"),
            name = "RIS Transition",
            objective = "Transition imaging RIS.",
            status = ProjectStatus.IMPLEMENTATION,
            timeline = ProjectTimeline(
                startsAt = null,
                endsAt = null,
            ),
            futureArchitecture =
                listOf(laterKnownFuture),
        )

        val service = TraceWorkflowService(
            productionWorkflows = listOf(current),
            projects = listOf(project),
        )

        val trace = service.trace(
            workflowId = WorkflowId("current-ris"),
            atTime =
                Instant.parse("2026-09-05T12:00:00Z"),
            knowledgeAsOf =
                Instant.parse("2026-08-22T12:00:00Z"),
        )

        assertTrue(trace.future.steps.isEmpty())

        assertTrue(
            trace.future.annotations.contains(
                "Future architecture was not yet known as of 2026-08-22T12:00:00Z",
            ),
        )
    }


    @Test
    fun `trace exposes evidence state for every workflow hop`() {
        val anchor = SourceAnchor(
            sourceId = SourceId("trace-source"),
            variantId = SourceVariantId("trace-variant"),
            locator = AnchorLocator.TextSpan(
                startOffset = 0,
                endOffset = 10,
            ),
        )

        val workflow = Workflow(
            id = WorkflowId("evidence-trace"),
            name = "Evidence Trace",
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = WorkflowState.CURRENT,
            evidenceState = EvidenceState.PLANNED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt =
                Instant.parse("2026-08-22T10:00:00Z"),
            steps = listOf(
                WorkflowStep(
                    id = WorkflowStepId("order"),
                    name = "Order",
                    system = "eClinicalWorks",
                    evidenceState = EvidenceState.CONFIRMED,
                    anchors = setOf(anchor),
                ),
                WorkflowStep(
                    id = WorkflowStepId("ris"),
                    name = "RIS",
                    system = "Merge RIS",
                    evidenceState = EvidenceState.OBSERVED,
                    anchors = setOf(anchor),
                ),
                WorkflowStep(
                    id = WorkflowStepId("pacs"),
                    name = "PACS",
                    system = "Merge PACS",
                    evidenceState = EvidenceState.PLANNED,
                ),
            ),
            evidenceAnchors = emptySet(),
        )

        val service = TraceWorkflowService(
            productionWorkflows = listOf(workflow),
            projects = emptyList(),
        )

        val trace = service.trace(
            workflowId = workflow.id,
            atTime =
                Instant.parse("2026-08-22T12:00:00Z"),
            knowledgeAsOf =
                Instant.parse("2026-08-22T12:00:00Z"),
        )

        assertTrue(
            trace.current.hops.any {
                it.system == "eClinicalWorks" &&
                    it.evidenceState == EvidenceState.CONFIRMED
            },
        )

        assertTrue(
            trace.current.hops.any {
                it.system == "Merge RIS" &&
                    it.evidenceState == EvidenceState.OBSERVED
            },
        )

        assertTrue(
            trace.current.hops.any {
                it.system == "Merge PACS" &&
                    it.evidenceState == EvidenceState.PLANNED
            },
        )
    }


    @Test
    fun `trace exposes failure domain for each hop`() {
        val workflow = Workflow(
            id = WorkflowId("failure-trace"),
            name = "Failure Trace",
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = WorkflowState.CURRENT,
            evidenceState = EvidenceState.PLANNED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt =
                Instant.parse("2026-08-22T10:00:00Z"),
            steps = listOf(
                WorkflowStep(
                    id = WorkflowStepId("order-step"),
                    name = "Order",
                    system = "eClinicalWorks",
                    evidenceState = EvidenceState.PLANNED,
                ),
                WorkflowStep(
                    id = WorkflowStepId("ris-step"),
                    name = "RIS",
                    system = "Merge RIS",
                    evidenceState = EvidenceState.PLANNED,
                ),
                WorkflowStep(
                    id = WorkflowStepId("pacs-step"),
                    name = "DMWL",
                    system = "Merge PACS",
                    evidenceState = EvidenceState.PLANNED,
                ),
            ),
            evidenceAnchors = emptySet(),
        )

        val service = TraceWorkflowService(
            productionWorkflows = listOf(workflow),
            projects = emptyList(),
        )

        val trace = service.trace(
            workflowId = workflow.id,
            atTime =
                Instant.parse("2026-08-22T12:00:00Z"),
            knowledgeAsOf =
                Instant.parse("2026-08-22T12:00:00Z"),
        )

        assertTrue(
            trace.current.hops.all {
                it.failureDomains.isNotEmpty()
            },
        )

        assertTrue(
            trace.current.hops
                .first { it.system == "Merge RIS" }
                .failureDomains
                .contains("ORDER_OR_INTERFACE")
        )

        assertTrue(
            trace.current.hops
                .first { it.system == "Merge PACS" }
                .failureDomains
                .contains("WORKLIST_OR_ROUTING")
        )
    }

    private fun workflow(
        id: String,
        name: String,
        state: WorkflowState,
        system: String,
        scope: KnowledgeScope,
        evidenceState: EvidenceState,
        effectiveFrom: Instant?,
    ): Workflow =
        Workflow(
            id = WorkflowId(id),
            name = name,
            scope = scope,
            state = state,
            evidenceState = evidenceState,
            effectiveFrom = effectiveFrom,
            effectiveTo = null,
            recordedAt =
                Instant.parse("2026-08-22T10:00:00Z"),
            steps = listOf(
                WorkflowStep(
                    id = WorkflowStepId("$id-step"),
                    name = "RIS",
                    system = system,
                    evidenceState = evidenceState,
                ),
            ),
            evidenceAnchors = emptySet(),
        )
}
