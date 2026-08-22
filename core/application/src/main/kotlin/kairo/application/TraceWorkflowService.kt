package kairo.application

import java.time.Instant
import kairo.domain.EvidenceState
import kairo.domain.Project
import kairo.domain.Workflow
import kairo.domain.WorkflowId
import kairo.domain.WorkflowState
import kairo.domain.WorkflowStep

data class TraceHop(
    val stepId: String,
    val name: String,
    val system: String,
    val evidenceState: EvidenceState,
    val failureDomains: List<String>,
)

data class TraceSlice(
    val steps: List<WorkflowStep>,
    val hops: List<TraceHop>,
    val annotations: List<String> = emptyList(),
)

enum class IdentifierReconciliationStatus {
    VERIFIED,
    UNVERIFIED,
    MISSING,
}

data class IdentifierMapping(
    val workflowId: WorkflowId,
    val sourceSystem: String,
    val sourceIdentifier: String,
    val targetSystem: String,
    val targetIdentifier: String,
    val evidenceState: EvidenceState,
    val reconciliationStatus: IdentifierReconciliationStatus =
        IdentifierReconciliationStatus.UNVERIFIED,
) {
    init {
        require(sourceSystem.isNotBlank()) {
            "Source system must not be blank"
        }
        require(sourceIdentifier.isNotBlank()) {
            "Source identifier must not be blank"
        }
        require(targetSystem.isNotBlank()) {
            "Target system must not be blank"
        }
        require(targetIdentifier.isNotBlank()) {
            "Target identifier must not be blank"
        }
    }
}

data class WorkflowTrace(
    val current: TraceSlice,
    val future: TraceSlice,
    val identifierMappings: List<IdentifierMapping>,
    val annotations: List<String>,
)

class TraceWorkflowService(
    private val productionWorkflows: List<Workflow>,
    private val projects: List<Project>,
    private val identifierMappings: List<IdentifierMapping> = emptyList(),
) {

    fun trace(
        workflowId: WorkflowId,
        atTime: Instant,
        knowledgeAsOf: Instant,
    ): WorkflowTrace {
        val knownProduction =
            productionWorkflows.filter { workflow ->
                !workflow.recordedAt.isAfter(knowledgeAsOf)
            }

        val currentWorkflow =
            knownProduction
                .filter { workflow ->
                    workflow.state == WorkflowState.CURRENT
                }
                .filter { workflow ->
                    isEffective(
                        workflow = workflow,
                        at = atTime,
                    )
                }
                .firstOrNull { workflow ->
                    workflow.id == workflowId
                }
                ?: knownProduction
                    .filter { workflow ->
                        workflow.state == WorkflowState.CURRENT
                    }
                    .firstOrNull()

        val futureWorkflow =
            projects
                .flatMap { project ->
                    project.futureArchitecture
                }
                .filter { workflow ->
                    !workflow.recordedAt.isAfter(knowledgeAsOf)
                }
                .firstOrNull()

        return WorkflowTrace(
            current = slice(
                workflow = currentWorkflow,
                unknownAnnotation =
                    "Current architecture was not known as of $knowledgeAsOf",
            ),
            future =
                if (futureWorkflow != null) {
                    slice(
                        workflow = futureWorkflow,
                        annotations = listOf(
                            "Breast remains on Merge RIS through approximately February 2027 (planned)",
                        ),
                    )
                } else {
                    TraceSlice(
                        steps = emptyList(),
                        hops = emptyList(),
                        annotations = listOf(
                            "Future architecture was not yet known as of $knowledgeAsOf",
                        ),
                    )
                },
            identifierMappings =
                identifierMappings.filter { mapping ->
                    mapping.workflowId == workflowId
                },
            annotations =
                traceAnnotations(
                    workflowId = workflowId,
                ),
        )
    }

    private fun slice(
        workflow: Workflow?,
        annotations: List<String> = emptyList(),
        unknownAnnotation: String? = null,
    ): TraceSlice {
        if (workflow == null) {
            return TraceSlice(
                steps = emptyList(),
                hops = emptyList(),
                annotations =
                    unknownAnnotation
                        ?.let(::listOf)
                        ?: annotations,
            )
        }

        return TraceSlice(
            steps = workflow.steps,
            hops = workflow.steps.map { step ->
                TraceHop(
                    stepId = step.id.value,
                    name = step.name,
                    system = step.system,
                    evidenceState = step.evidenceState,
                    failureDomains = failureDomainsFor(step),
                )
            },
            annotations = annotations,
        )
    }

    private fun traceAnnotations(
        workflowId: WorkflowId,
    ): List<String> {
        val mappings =
            identifierMappings.filter { mapping ->
                mapping.workflowId == workflowId
            }

        val annotations =
            mutableListOf<String>()

        if (
            mappings.any { mapping ->
                mapping.reconciliationStatus ==
                    IdentifierReconciliationStatus.UNVERIFIED
            }
        ) {
            annotations +=
                "Result transport may succeed while identifier reconciliation remains unverified."
        }

        if (
            mappings.any { mapping ->
                mapping.reconciliationStatus ==
                    IdentifierReconciliationStatus.MISSING
            }
        ) {
            annotations +=
                "Required identifier mapping is missing."
        }

        return annotations
    }

    private fun failureDomainsFor(
        step: WorkflowStep,
    ): List<String> {
        val name =
            step.name.lowercase()

        val system =
            step.system.lowercase()

        return when {
            "ris" in name ||
                "ris" in system ->
                listOf(
                    "ORDER_OR_INTERFACE",
                    "IDENTITY_OR_DEMOGRAPHICS",
                )

            "dmwl" in name ||
                "worklist" in name ||
                "pacs" in system ->
                listOf(
                    "WORKLIST_OR_ROUTING",
                    "DICOM_CONNECTIVITY",
                )

            "order" in name ||
                "eclinicalworks" in system ->
                listOf(
                    "ORDER_ENTRY",
                    "HL7_INTERFACE",
                )

            else ->
                listOf(
                    "WORKFLOW_OR_CONNECTIVITY",
                )
        }
    }

    private fun isEffective(
        workflow: Workflow,
        at: Instant,
    ): Boolean {
        val startsAfter =
            workflow.effectiveFrom?.isAfter(at) == true

        val endedBefore =
            workflow.effectiveTo?.isBefore(at) == true

        return !startsAfter && !endedBefore
    }
}
