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

        val candidate = CaptureCandidate.from(
            id = CaptureCandidateId("candidate-non-breast-transition"),
            captureSession = session,
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
            status = ProjectStatus.IMPLEMENTATION,
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
                status = ProjectStatus.IMPLEMENTATION,
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
        val session = CaptureSession(
            id = CaptureSessionId("session-1"),
            capturedAt = Instant.parse("2026-08-20T00:00:00Z"),
            anchors = suppliedAnchors,
        )
        val candidate = CaptureCandidate.from(
            id = CaptureCandidateId("candidate-1"),
            captureSession = session,
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

    @Test
    fun `source preserves a coherent root lineage and exact variant anchors`() {
        val sourceId = SourceId("migration-meeting")
        val importedAt = Instant.parse("2026-08-20T10:00:00Z")
        val rootAnchor = anchor(sourceId, "migration-meeting-v1", 0)
        val updateAnchor = anchor(sourceId, "migration-meeting-v2", 10)
        val root = variant(sourceId, "migration-meeting-v1", 1, "root-hash", importedAt, null, setOf(rootAnchor))
        val update = variant(
            sourceId,
            "migration-meeting-v2",
            2,
            "update-hash",
            Instant.parse("2026-08-21T10:00:00Z"),
            root.id,
            setOf(updateAnchor),
        )

        val source = Source(
            id = sourceId,
            origin = SourceOrigin.IMPORT,
            type = SourceType.PDF,
            contentHash = "root-hash",
            importedAt = importedAt,
            classification = SourceClassification.INTERNAL,
            variants = listOf(root, update),
            anchors = setOf(rootAnchor, updateAnchor),
        )

        assertEquals(setOf(rootAnchor, updateAnchor), source.anchors)
        assertEquals(listOf(root.id, update.id), source.variants.map { it.id })
    }

    @Test
    fun `source rejects dangling cyclic duplicate and mismatched lineage metadata`() {
        val sourceId = SourceId("migration-meeting")
        val importedAt = Instant.parse("2026-08-20T10:00:00Z")
        val rootAnchor = anchor(sourceId, "migration-meeting-v1", 0)
        val root = variant(sourceId, "migration-meeting-v1", 1, "root-hash", importedAt, null, setOf(rootAnchor))
        val dangling = variant(
            sourceId,
            "migration-meeting-v2",
            2,
            "update-hash",
            importedAt,
            SourceVariantId("missing-parent"),
            emptySet(),
        )
        val selfParent = variant(sourceId, "migration-meeting-v3", 3, "self-hash", importedAt, SourceVariantId("migration-meeting-v3"), emptySet())
        val duplicateVersion = variant(sourceId, "migration-meeting-v4", 1, "duplicate-hash", importedAt, root.id, emptySet())

        assertFailsWith<IllegalArgumentException> { source(sourceId, "root-hash", importedAt, listOf(root, dangling), setOf(rootAnchor)) }
        assertFailsWith<IllegalArgumentException> { source(sourceId, "root-hash", importedAt, listOf(root, selfParent), setOf(rootAnchor)) }
        assertFailsWith<IllegalArgumentException> { source(sourceId, "root-hash", importedAt, listOf(root, duplicateVersion), setOf(rootAnchor)) }
        assertFailsWith<IllegalArgumentException> { source(sourceId, "different-hash", importedAt, listOf(root), setOf(rootAnchor)) }
        assertFailsWith<IllegalArgumentException> { source(sourceId, "root-hash", importedAt, listOf(root), emptySet()) }
    }

    @Test
    fun `candidate evidence must be attributed to its capture session`() {
        val sessionAnchor = anchor(SourceId("meeting-notes"), "meeting-notes-v1", 0)
        val unrelatedAnchor = anchor(SourceId("migration-tracker"), "migration-tracker-v1", 0)
        val session = CaptureSession(
            id = CaptureSessionId("migration-meeting"),
            capturedAt = Instant.parse("2026-08-20T15:00:00Z"),
            anchors = setOf(sessionAnchor),
        )

        assertFailsWith<IllegalArgumentException> {
            CaptureCandidate.from(
                id = CaptureCandidateId("unattributed-candidate"),
                captureSession = session,
                text = "Radiology Workflow candidate",
                scope = KnowledgeScope.PROJECT,
                state = EvidenceState.VERIFY,
                evidenceAnchors = setOf(unrelatedAnchor),
            )
        }

        val candidate = CaptureCandidate.from(
            id = CaptureCandidateId("attributed-candidate"),
            captureSession = session,
            text = "Radiology Workflow candidate",
            scope = KnowledgeScope.PROJECT,
            state = EvidenceState.VERIFY,
            evidenceAnchors = setOf(sessionAnchor),
        )

        assertEquals(session.id, candidate.captureSessionId)
    }

    @Test
    fun `project rejects non project workflows in its architecture`() {
        val productionFuture = workflow(
            id = "production-future",
            name = "Radiology Workflow production future",
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = WorkflowState.FUTURE,
            evidenceState = EvidenceState.PLANNED,
        )

        assertFailsWith<IllegalArgumentException> {
            project(futureArchitecture = listOf(productionFuture))
        }
        assertEquals(KnowledgeScope.MANA_PRODUCTION, productionFuture.scope)
    }

    @Test
    fun `project rejects duplicate architecture and context identifiers`() {
        val projectFuture = workflow(
            id = "project-future",
            name = "Radiology Workflow project future",
            scope = KnowledgeScope.PROJECT,
            state = WorkflowState.FUTURE,
            evidenceState = EvidenceState.PLANNED,
        )
        val projectTransition = workflow(
            id = "project-future",
            name = "Radiology Workflow project transition",
            scope = KnowledgeScope.PROJECT,
            state = WorkflowState.TRANSITION,
            evidenceState = EvidenceState.PLANNED,
        )

        assertFailsWith<IllegalArgumentException> {
            project(transitionArchitecture = listOf(projectTransition), futureArchitecture = listOf(projectFuture))
        }
        assertFailsWith<IllegalArgumentException> {
            project(knowledge = listOf(projectFact("fact-duplicate"), projectFact("fact-duplicate")))
        }
        assertFailsWith<IllegalArgumentException> {
            project(decisions = listOf(decision("decision-duplicate"), decision("decision-duplicate")))
        }
        assertFailsWith<IllegalArgumentException> {
            project(risks = listOf(risk("risk-duplicate"), risk("risk-duplicate")))
        }
        assertFailsWith<IllegalArgumentException> {
            project(openQuestions = listOf(question("question-duplicate"), question("question-duplicate")))
        }
        assertFailsWith<IllegalArgumentException> {
            project(actionItems = listOf(action("action-duplicate"), action("action-duplicate")))
        }
    }

    @Test
    fun `project meetings must reference retained capture sessions`() {
        assertFailsWith<IllegalArgumentException> {
            project(
                meetings = listOf(
                    ProjectMeeting(
                        captureSessionId = CaptureSessionId("missing-session"),
                        occurredAt = Instant.parse("2026-08-20T15:00:00Z"),
                        title = "Radiology Workflow review",
                    ),
                ),
            )
        }
    }

    @Test
    fun `confirmed and observed workflow records require source anchors`() {
        assertFailsWith<IllegalArgumentException> {
            WorkflowStep(
                id = WorkflowStepId("unanchored-confirmed-step"),
                name = "Schedule radiology imaging",
                system = "Merge RIS",
                evidenceState = EvidenceState.CONFIRMED,
            )
        }
        assertFailsWith<IllegalArgumentException> {
            Workflow(
                id = WorkflowId("unanchored-observed-workflow"),
                name = "Observed Radiology Workflow",
                scope = KnowledgeScope.MANA_PRODUCTION,
                state = WorkflowState.CURRENT,
                evidenceState = EvidenceState.OBSERVED,
                effectiveFrom = null,
                effectiveTo = null,
                recordedAt = Instant.parse("2026-08-20T00:00:00Z"),
                steps = listOf(
                    WorkflowStep(
                        id = WorkflowStepId("planned-step"),
                        name = "Plan radiology imaging",
                        system = "Merge RIS",
                        evidenceState = EvidenceState.PLANNED,
                    ),
                ),
                evidenceAnchors = emptySet(),
            )
        }
    }

    @Test
    fun `project statuses preserve the locked lifecycle distinctions`() {
        assertEquals(
            setOf("IDEA", "DISCOVERY", "PLANNING", "IMPLEMENTATION", "VALIDATION", "GO_LIVE", "HYPERCARE", "COMPLETED", "HISTORICAL"),
            ProjectStatus.entries.map { it.name }.toSet(),
        )
    }

    private fun workflow(
        id: String,
        name: String,
        scope: KnowledgeScope,
        state: WorkflowState,
        evidenceState: EvidenceState,
    ): Workflow {
        val workflowAnchor = anchor(SourceId("$id-source"), "$id-v1", 0)
        val requiresAnchors = evidenceState in setOf(EvidenceState.CONFIRMED, EvidenceState.OBSERVED)
        return Workflow(
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
                anchors = if (requiresAnchors) setOf(workflowAnchor) else emptySet(),
            ),
        ),
        evidenceAnchors = if (requiresAnchors) setOf(workflowAnchor) else emptySet(),
        )
    }

    private fun anchor(sourceId: SourceId, variantId: String, startOffset: Int): SourceAnchor = SourceAnchor(
        sourceId = sourceId,
        variantId = SourceVariantId(variantId),
        locator = AnchorLocator.TextSpan(startOffset, startOffset + 5),
    )

    private fun variant(
        sourceId: SourceId,
        id: String,
        version: Int,
        contentHash: String,
        importedAt: Instant,
        parentVariantId: SourceVariantId?,
        anchors: Set<SourceAnchor>,
    ) = SourceVariant(SourceVariantId(id), sourceId, version, contentHash, importedAt, parentVariantId, ExtractionStatus.EXTRACTED, anchors)

    private fun source(
        id: SourceId,
        contentHash: String,
        importedAt: Instant,
        variants: List<SourceVariant>,
        anchors: Set<SourceAnchor>,
    ) = Source(id, SourceOrigin.IMPORT, SourceType.PDF, contentHash, importedAt, SourceClassification.INTERNAL, variants, anchors)

    private fun project(
        currentArchitecture: List<Workflow> = emptyList(),
        transitionArchitecture: List<Workflow> = emptyList(),
        futureArchitecture: List<Workflow> = emptyList(),
        historicalArchitecture: List<Workflow> = emptyList(),
        knowledge: List<FactVersion> = emptyList(),
        decisions: List<Decision> = emptyList(),
        risks: List<Risk> = emptyList(),
        openQuestions: List<OpenQuestion> = emptyList(),
        actionItems: List<ActionItem> = emptyList(),
        meetings: List<ProjectMeeting> = emptyList(),
        captureSessionIds: Set<CaptureSessionId> = emptySet(),
    ) = Project(
        id = ProjectId("ris-evolution"),
        name = "Radiology Workflow RIS evolution",
        objective = "Plan the transition without changing production truth prematurely.",
        status = ProjectStatus.IMPLEMENTATION,
        timeline = ProjectTimeline(Instant.parse("2026-08-20T00:00:00Z"), null),
        currentArchitecture = currentArchitecture,
        transitionArchitecture = transitionArchitecture,
        futureArchitecture = futureArchitecture,
        historicalArchitecture = historicalArchitecture,
        knowledge = knowledge,
        decisions = decisions,
        risks = risks,
        openQuestions = openQuestions,
        actionItems = actionItems,
        meetings = meetings,
        captureSessionIds = captureSessionIds,
    )

    private fun projectFact(id: String) = FactVersion(
        id = FactId(id), subject = EntityId("workflow-radiology"), predicate = "USES",
        objectValue = FactObject.Literal("Merge RIS"), scope = KnowledgeScope.PROJECT, state = EvidenceState.PLANNED,
        effectiveFrom = null, effectiveTo = null, recordedAt = Instant.parse("2026-08-20T00:00:00Z"),
        lastValidatedAt = null, evidence = setOf(EvidenceRef("meeting-notes")),
    )

    private fun decision(id: String) = Decision(DecisionId(id), "Radiology Workflow decision", EvidenceState.PLANNED, emptySet())

    private fun risk(id: String) = Risk(RiskId(id), "Radiology Workflow risk", "Validate before go-live", emptySet())

    private fun question(id: String) = OpenQuestion(OpenQuestionId(id), "Which interface should be verified?", emptySet())

    private fun action(id: String) = ActionItem(ActionItemId(id), "Validate the radiology interface", null, emptySet())
}
