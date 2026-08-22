package kairo.application

import kairo.domain.EvidenceRef
import kairo.domain.KnowledgeScope

data class ReasoningPacket(
    val question: String,
)

data class AnswerClaim(
    val text: String,
    val scope: KnowledgeScope,
    val evidenceRefs: Set<EvidenceRef>,
)

data class KairoAnswer(
    val text: String,
    val claims: List<AnswerClaim> = emptyList(),
)

interface ReasoningProvider {
    suspend fun analyze(
        packet: ReasoningPacket,
    ): KairoAnswer
}
