package kairo.platform.ingestion

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.work.WorkManager
import androidx.work.testing.WorkManagerTestInitHelper
import kairo.domain.CaptureSessionId
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import kotlin.test.assertEquals

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class IngestionWorkSchedulerTest {
    private lateinit var manager: WorkManager

    @Before fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        WorkManagerTestInitHelper.initializeTestWorkManager(context)
        manager = WorkManager.getInstance(context)
    }

    @Test fun `enqueues one unique work item for a session`() {
        val sessionId = CaptureSessionId("work-session")
        val scheduler = IngestionWorkScheduler(manager)

        scheduler.enqueue(sessionId)
        scheduler.enqueue(sessionId)

        assertEquals(1, manager.getWorkInfosForUniqueWork("kairo-ingestion-work-session").get().size)
    }
}
