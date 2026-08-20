package kairo.domain

import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class ContextDomainTest {
    @Test
    fun `candidate from batch retains every contributing anchor`() {
        val pdfAnchor = SourceAnchor(
            sourceId = SourceId("meeting-notes"),
            variantId = SourceVariantId("meeting-notes-v1"),
            locator = AnchorLocator.PdfPageBox(page = 2, left = 10.0, top = 20.0, right = 90.0, bottom = 120.0),
        )
        val sheetAnchor = SourceAnchor(
            sourceId = SourceId("migration-tracker"),
            variantId = SourceVariantId("migration-tracker-v1"),
            locator = AnchorLocator.SheetRange(sheet = "Timeline", firstRow = 4, firstColumn = 2, lastRow = 7, lastColumn = 5),
        )
        val session = CaptureSession(
            id = CaptureSessionId("migration-meeting-batch"),
            capturedAt = Instant.parse("2026-08-20T15:00:00Z"),
            anchors = setOf(pdfAnchor, sheetAnchor),
        )

        val candidate = CaptureCandidate(
            id = CaptureCandidateId("candidate-non-breast-transition"),
            captureSessionId = session.id,
            text = "Non-breast imaging is planned to transition to AbbaDox CareFlow RIS.",
            scope = KnowledgeScope.PROJECT,
            state = EvidenceState.PLANNED,
            evidenceAnchors = setOf(pdfAnchor, sheetAnchor),
        )

        assertEquals(setOf(pdfAnchor, sheetAnchor), candidate.evidenceAnchors)
        assertEquals(setOf(pdfAnchor, sheetAnchor), session.anchors)
    }

    @Test
    fun `future non breast workflow does not replace current breast workflow`() {
        val breastCurrent = workflow(
            id = "breast-merge-ris-current",
            name = "Breast mammography on Merge RIS",
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = WorkflowState.CURRENT,
            evidenceState = EvidenceState.CONFIRMED,
        )
        val nonBreastFuture = workflow(
            id = "non-breast-abbadox-future",
            name = "Non-breast imaging on AbbaDox CareFlow RIS",
            scope = KnowledgeScope.PROJECT,
            state = WorkflowState.FUTURE,
            evidenceState = EvidenceState.PLANNED,
        )

        assertEquals(WorkflowState.CURRENT, breastCurrent.state)
        assertEquals(WorkflowState.FUTURE, nonBreastFuture.state)
        assertNotEquals(breastCurrent.scope, nonBreastFuture.scope)
        assertEquals("Merge RIS", breastCurrent.steps.single().system)
        assertEquals("AbbaDox CareFlow RIS", nonBreastFuture.steps.single().system)
    }

    @Test
    fun `project planned knowledge remains scoped to project`() {
        val projectFact = FactVersion(
            id = FactId("breast-merge-continuation"),
            subject = EntityId("workflow-breast-mammography"),
            predicate = "USES",
            objectValue = FactObject.Literal("Merge RIS through approximately February 2027"),
            scope = KnowledgeScope.PROJECT,
            state = EvidenceState.PLANNED,
            effectiveFrom = Instant.parse("2026-08-20T00:00:00Z"),
            effectiveTo = null,
            recordedAt = Instant.parse("2026-08-20T00:00:00Z"),
            lastValidatedAt = null,
            evidence = setOf(EvidenceRef("meeting-notes")),
        )

        val project = Project(
            id = ProjectId("ris-evolution"),
            name = "Radiology Workflow RIS evolution",
            objective = "Plan the transition without changing production truth prematurely.",
            status = ProjectStatus.ACTIVE,
            timeline = ProjectTimeline(
                startsAt = Instant.parse("2026-08-20T00:00:00Z"),
                endsAt = Instant.parse("2027-02-28T00:00:00Z"),
            ),
            knowledge = listOf(projectFact),
        )

        assertEquals(KnowledgeScope.PROJECT, project.knowledge.single().scope)
        assertEquals(EvidenceState.PLANNED, project.knowledge.single().state)
        assertTrue(project.knowledge.single() !in CurrentBestUnderstanding.project(listOf(projectFact)))
    }

    @Test
    fun `project rejects knowledge that claims production scope`() {
        val productionFact = FactVersion(
            id = FactId("production-fact"),
            subject = EntityId("workflow-breast-mammography"),
            predicate = "USES",
            objectValue = FactObject.Literal("Merge RIS"),
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.CONFIRMED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt = Instant.parse("2026-08-20T00:00:00Z"),
            lastValidatedAt = null,
            evidence = setOf(EvidenceRef("source-1")),
        )

        assertFailsWith<IllegalArgumentException> {
            Project(
                id = ProjectId("ris-evolution"),
                name = "Radiology Workflow RIS evolution",
                objective = "Plan the transition without changing production truth prematurely.",
                status = ProjectStatus.ACTIVE,
                timeline = ProjectTimeline(Instant.parse("2026-08-20T00:00:00Z"), null),
                knowledge = listOf(productionFact),
            )
        }
    }

    @Test
    fun `context collections are immutable snapshots`() {
        val anchor = SourceAnchor(
            sourceId = SourceId("meeting-notes"),
            variantId = SourceVariantId("meeting-notes-v1"),
            locator = AnchorLocator.TextSpan(0, 12),
        )
        val suppliedAnchors = mutableSetOf(anchor)
        val candidate = CaptureCandidate(
            id = CaptureCandidateId("candidate-1"),
            captureSessionId = CaptureSessionId("session-1"),
            text = "Radiology Workflow candidate",
            scope = KnowledgeScope.PROJECT,
            state = EvidenceState.VERIFY,
            evidenceAnchors = suppliedAnchors,
        )

        suppliedAnchors.clear()

        assertEquals(setOf(anchor), candidate.evidenceAnchors)
        assertFailsWith<UnsupportedOperationException> {
            (candidate.evidenceAnchors as MutableSet<SourceAnchor>).clear()
        }
    }

    private fun workflow(
        id: String,
        name: String,
        scope: KnowledgeScope,
        state: WorkflowState,
        evidenceState: EvidenceState,
    ) = Workflow(
        id = WorkflowId(id),
        name = name,
        scope = scope,
        state = state,
        evidenceState = evidenceState,
        effectiveFrom = Instant.parse("2026-08-20T00:00:00Z"),
        effectiveTo = null,
        recordedAt = Instant.parse("2026-08-20T00:00:00Z"),
        steps = listOf(
            WorkflowStep(
                id = WorkflowStepId("$id-step"),
                name = "Schedule radiology imaging",
                system = if (state == WorkflowState.CURRENT) "Merge RIS" else "AbbaDox CareFlow RIS",
                evidenceState = evidenceState,
            ),
        ),
        evidenceAnchors = emptySet(),
    )
}
