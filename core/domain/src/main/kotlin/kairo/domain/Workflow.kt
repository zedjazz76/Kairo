package kairo.domain

import java.time.Instant

@JvmInline
value class WorkflowId(val value: String) {
    init {
        require(value.isNotBlank()) { "WorkflowId must not be blank" }
    }
}

@JvmInline
value class WorkflowStepId(val value: String) {
    init {
        require(value.isNotBlank()) { "WorkflowStepId must not be blank" }
    }
}

enum class WorkflowState {
    CURRENT,
    TRANSITION,
    FUTURE,
    HISTORICAL,
}

class WorkflowStep(
    val id: WorkflowStepId,
    val name: String,
    val system: String,
    val evidenceState: EvidenceState,
    anchors: Set<SourceAnchor> = emptySet(),
) {
    val anchors: Set<SourceAnchor> = contextSetSnapshot(anchors)

    init {
        require(name.isNotBlank()) { "Workflow step name must not be blank" }
        require(system.isNotBlank()) { "Workflow step system must not be blank" }
    }
}

class Workflow(
    val id: WorkflowId,
    val name: String,
    val scope: KnowledgeScope,
    val state: WorkflowState,
    val evidenceState: EvidenceState,
    val effectiveFrom: Instant?,
    val effectiveTo: Instant?,
    val recordedAt: Instant,
    steps: List<WorkflowStep>,
    evidenceAnchors: Set<SourceAnchor>,
) {
    val steps: List<WorkflowStep> = contextListSnapshot(steps)
    val evidenceAnchors: Set<SourceAnchor> = contextSetSnapshot(evidenceAnchors)

    init {
        require(name.isNotBlank()) { "Workflow name must not be blank" }
        require(effectiveFrom == null || effectiveTo == null || !effectiveTo.isBefore(effectiveFrom)) {
            "Workflow effectiveTo must not be before effectiveFrom"
        }
        require(this.steps.isNotEmpty()) { "Workflow must contain at least one step" }
        require(this.steps.map { it.id }.toSet().size == this.steps.size) { "Workflow step identifiers must be unique" }
    }
}
