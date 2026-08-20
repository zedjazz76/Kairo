package kairo.domain

import java.time.Instant

@JvmInline
value class ProjectId(val value: String) {
    init {
        require(value.isNotBlank()) { "ProjectId must not be blank" }
    }
}

@JvmInline
value class DecisionId(val value: String) {
    init {
        require(value.isNotBlank()) { "DecisionId must not be blank" }
    }
}

@JvmInline
value class RiskId(val value: String) {
    init {
        require(value.isNotBlank()) { "RiskId must not be blank" }
    }
}

@JvmInline
value class OpenQuestionId(val value: String) {
    init {
        require(value.isNotBlank()) { "OpenQuestionId must not be blank" }
    }
}

@JvmInline
value class ActionItemId(val value: String) {
    init {
        require(value.isNotBlank()) { "ActionItemId must not be blank" }
    }
}

enum class ProjectStatus {
    IDEA,
    DISCOVERY,
    PLANNING,
    IMPLEMENTATION,
    VALIDATION,
    GO_LIVE,
    HYPERCARE,
    COMPLETED,
    HISTORICAL,
}

data class ProjectTimeline(
    val startsAt: Instant?,
    val endsAt: Instant?,
) {
    init {
        require(startsAt == null || endsAt == null || !endsAt.isBefore(startsAt)) {
            "Project timeline end must not be before its start"
        }
    }
}

class Decision(
    val id: DecisionId,
    val statement: String,
    val state: EvidenceState,
    anchors: Set<SourceAnchor>,
) {
    val anchors: Set<SourceAnchor> = contextSetSnapshot(anchors)

    init {
        require(statement.isNotBlank()) { "Decision statement must not be blank" }
    }
}

class Risk(
    val id: RiskId,
    val description: String,
    val mitigation: String,
    anchors: Set<SourceAnchor>,
) {
    val anchors: Set<SourceAnchor> = contextSetSnapshot(anchors)

    init {
        require(description.isNotBlank()) { "Risk description must not be blank" }
        require(mitigation.isNotBlank()) { "Risk mitigation must not be blank" }
    }
}

class OpenQuestion(
    val id: OpenQuestionId,
    val question: String,
    anchors: Set<SourceAnchor> = emptySet(),
) {
    val anchors: Set<SourceAnchor> = contextSetSnapshot(anchors)

    init {
        require(question.isNotBlank()) { "Open question must not be blank" }
    }
}

class ActionItem(
    val id: ActionItemId,
    val description: String,
    val dueAt: Instant? = null,
    anchors: Set<SourceAnchor> = emptySet(),
) {
    val anchors: Set<SourceAnchor> = contextSetSnapshot(anchors)

    init {
        require(description.isNotBlank()) { "Action item description must not be blank" }
    }
}

class ProjectMeeting(
    val captureSessionId: CaptureSessionId,
    val occurredAt: Instant,
    val title: String,
) {
    init {
        require(title.isNotBlank()) { "Project meeting title must not be blank" }
    }
}

class Project(
    val id: ProjectId,
    val name: String,
    val objective: String,
    val status: ProjectStatus,
    val timeline: ProjectTimeline,
    systems: Set<EntityId> = emptySet(),
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
) {
    val systems: Set<EntityId> = contextSetSnapshot(systems)
    val currentArchitecture: List<Workflow> = contextListSnapshot(currentArchitecture)
    val transitionArchitecture: List<Workflow> = contextListSnapshot(transitionArchitecture)
    val futureArchitecture: List<Workflow> = contextListSnapshot(futureArchitecture)
    val historicalArchitecture: List<Workflow> = contextListSnapshot(historicalArchitecture)
    val knowledge: List<FactVersion> = contextListSnapshot(knowledge)
    val decisions: List<Decision> = contextListSnapshot(decisions)
    val risks: List<Risk> = contextListSnapshot(risks)
    val openQuestions: List<OpenQuestion> = contextListSnapshot(openQuestions)
    val actionItems: List<ActionItem> = contextListSnapshot(actionItems)
    val meetings: List<ProjectMeeting> = contextListSnapshot(meetings)
    val captureSessionIds: Set<CaptureSessionId> = contextSetSnapshot(captureSessionIds)

    init {
        require(name.isNotBlank()) { "Project name must not be blank" }
        require(objective.isNotBlank()) { "Project objective must not be blank" }
        require(this.currentArchitecture.all { it.state == WorkflowState.CURRENT }) {
            "Current architecture must contain current workflows"
        }
        require(this.transitionArchitecture.all { it.state == WorkflowState.TRANSITION }) {
            "Transition architecture must contain transition workflows"
        }
        require(this.futureArchitecture.all { it.state == WorkflowState.FUTURE }) {
            "Future architecture must contain future workflows"
        }
        require(this.historicalArchitecture.all { it.state == WorkflowState.HISTORICAL }) {
            "Historical architecture must contain historical workflows"
        }
        val architecture = this.currentArchitecture +
            this.transitionArchitecture +
            this.futureArchitecture +
            this.historicalArchitecture
        require(architecture.all { it.scope == KnowledgeScope.PROJECT }) {
            "Project architecture workflows must remain project-scoped"
        }
        requireUnique(architecture.map { it.id }, "workflow")
        require(this.knowledge.all { it.scope == KnowledgeScope.PROJECT }) {
            "Project knowledge must remain project-scoped"
        }
        requireUnique(this.knowledge.map { it.id }, "fact")
        requireUnique(this.decisions.map { it.id }, "decision")
        requireUnique(this.risks.map { it.id }, "risk")
        requireUnique(this.openQuestions.map { it.id }, "open question")
        requireUnique(this.actionItems.map { it.id }, "action item")
        require(this.meetings.all { it.captureSessionId in this.captureSessionIds }) {
            "Project meetings must reference retained capture sessions"
        }
    }

    private fun <T> requireUnique(ids: List<T>, label: String) {
        require(ids.toSet().size == ids.size) { "Project $label identifiers must be unique" }
    }
}
