package kairo.application

import org.junit.Assert.assertEquals
import org.junit.Test

class KairoAnswerStructureTest {

    @Test
    fun `answer carries structured presentation fields`() {
        val answer =
            KairoAnswer(
                text = "Merge PACS currently hosts the modality worklist.",
                assessment = "Current evidence supports Merge PACS as the active DMWL host.",
                currentManaUnderstanding = "Merge PACS is the observed production DMWL host.",
                nextAction = "Verify any migration-specific worklist routing before cutover.",
                confidence = AnswerConfidence.HIGH,
            )

        assertEquals(
            "Current evidence supports Merge PACS as the active DMWL host.",
            answer.assessment,
        )
        assertEquals(
            "Merge PACS is the observed production DMWL host.",
            answer.currentManaUnderstanding,
        )
        assertEquals(
            "Verify any migration-specific worklist routing before cutover.",
            answer.nextAction,
        )
        assertEquals(AnswerConfidence.HIGH, answer.confidence)
    }
}
