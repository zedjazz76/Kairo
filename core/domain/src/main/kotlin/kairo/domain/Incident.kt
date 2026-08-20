package kairo.domain

@JvmInline
value class IncidentPatternId(val value: String) {
    init {
        require(value.isNotBlank()) { "IncidentPatternId must not be blank" }
    }
}

class IncidentPattern(
    val id: IncidentPatternId,
    val symptom: String,
    val affectedWorkflow: WorkflowId,
    val rootCause: String,
    val resolution: String,
    val prevention: String,
    val scope: KnowledgeScope,
    val evidenceState: EvidenceState,
    evidenceAnchors: Set<SourceAnchor>,
) {
    val evidenceAnchors: Set<SourceAnchor> = contextSetSnapshot(evidenceAnchors)

    init {
        require(symptom.isNotBlank()) { "Incident symptom must not be blank" }
        require(rootCause.isNotBlank()) { "Incident root cause must not be blank" }
        require(resolution.isNotBlank()) { "Incident resolution must not be blank" }
        require(prevention.isNotBlank()) { "Incident prevention must not be blank" }
        require(scope == KnowledgeScope.INCIDENT) { "Incident patterns must use incident scope" }
        require(this.evidenceAnchors.isNotEmpty()) { "Incident pattern must retain source evidence" }
    }
}
