package kairo.android.reasoning

import kairo.application.AnswerAction
import kairo.application.AnswerClaim
import kairo.application.AnswerConfidence
import kairo.application.KairoAnswer
import kairo.domain.EvidenceRef
import kairo.domain.KnowledgeScope

data class RelayDeepAnalyzeResponse(
    val text: String,
    val claims: List<RelayClaim>,
)

data class RelayClaim(
    val text: String,
    val scope: String,
    val evidenceRefs: List<String>,
    val action: String,
)

object RelayAnswerMapper {

    fun map(response: RelayDeepAnalyzeResponse): KairoAnswer =
        KairoAnswer(
            text = response.text,
            claims =
                response.claims.map { claim ->
                    AnswerClaim(
                        text = claim.text,
                        scope = KnowledgeScope.valueOf(claim.scope),
                        evidenceRefs = claim.evidenceRefs.map(::EvidenceRef).toSet(),
                        action = AnswerAction.valueOf(claim.action),
                    )
                },
            confidence = AnswerConfidence.UNKNOWN,
        )
}
