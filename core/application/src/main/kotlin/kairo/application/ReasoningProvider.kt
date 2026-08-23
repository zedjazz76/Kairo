package kairo.application

import kairo.domain.EvidenceRef
import kairo.domain.KnowledgeScope
import kairo.retrieval.EvidenceBundle
import kairo.retrieval.RankedFact

data class ReasoningPacket(
    val question: String,
    val evidence: EvidenceBundle,
    val confirmed: List<RankedFact>,
    val observed: List<RankedFact>,
    val planned: List<RankedFact>,
    val hypotheses: List<RankedFact>,
    val unknowns: List<String>,
    val prohibitedActions: List<String>,
)

enum class AnswerAction {
    NONE,
    ADVISORY,
    PRODUCTION_WRITE,
}

enum class AnswerConfidence {
    HIGH,
    MEDIUM,
    LOW,
    UNKNOWN,
}

data class AnswerClaim(
    val text: String,
    val scope: KnowledgeScope,
    val evidenceRefs: Set<EvidenceRef>,
    val action: AnswerAction = AnswerAction.NONE,
)

data class KairoAnswer(
    val text: String,
    val claims: List<AnswerClaim> = emptyList(),
    val assessment: String? = null,
    val currentManaUnderstanding: String? = null,
    val nextAction: String? = null,
    val confidence: AnswerConfidence = AnswerConfidence.UNKNOWN,
)

interface ReasoningProvider {
    suspend fun analyze(
        packet: ReasoningPacket,
    ): KairoAnswer
}
