package kairo.android.app

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class KairoCompositionRootTest {

    @Test
    fun composition_root_exposes_copilot() {
        val root =
            KairoCompositionRoot.empty()

        assertNotNull(root.copilot)
    }

    @Test
    fun empty_root_answers_from_real_core_quick_path() =
        runBlocking {
            val root =
                KairoCompositionRoot.empty()

            val answer =
                root.copilot.ask(
                    "Who hosts the modality worklist?",
                )

            assertEquals(
                "I don't know from the available MANA evidence.",
                answer,
            )
        }
}
