package kairo.android.app

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class KairoActivityMemoryFlowTest {

    @Test
    fun activity_exposes_shared_memory_inbox_to_shell() {
        val sessionClass =
            KairoActivity::class.java

        val fieldNames =
            sessionClass.declaredFields
                .map { it.name }

        check(
            "memoryInbox" in fieldNames,
        ) {
            "KairoActivity should retain the shared MemoryInboxService used by the shell"
        }
    }
}
