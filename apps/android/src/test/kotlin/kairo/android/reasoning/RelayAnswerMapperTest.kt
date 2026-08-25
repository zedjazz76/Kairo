package kairo.android.reasoning

import kairo.application.AnswerAction
import kairo.application.AnswerConfidence
import kairo.application.KairoAnswer
import kairo.domain.EvidenceRef
import kairo.domain.KnowledgeScope
import org.junit.Assert.assertEquals
import org.junit.Test

class RelayAnswerMapperTest {

    @Test
    fun `maps relay response into evidence-bound Kairo answer`() {
        val answer =
            RelayAnswerMapper.map(
                RelayDeepAnalyzeResponse(
                    text = "Validate routing.",
                    claims =
                        listOf(
                            RelayClaim(
                                text = "Routing evidence exists.",
                                scope = "MANA_PRODUCTION",
                                evidenceRefs = listOf("source-1"),
                                action = "ADVISORY",
                            ),
                        ),
                ),
            )

        assertEquals(
            KairoAnswer(
                text = "Validate routing.",
                claims =
                    listOf(
                        kairo.application.AnswerClaim(
                            text = "Routing evidence exists.",
                            scope = KnowledgeScope.MANA_PRODUCTION,
                            evidenceRefs = setOf(EvidenceRef("source-1")),
                            action = AnswerAction.ADVISORY,
                        ),
                    ),
                confidence = AnswerConfidence.UNKNOWN,
            ),
            answer,
        )
    }
}
