package kairo.platform.ingestion

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.work.WorkManager
import androidx.work.WorkInfo
import androidx.work.Configuration
import androidx.work.testing.WorkManagerTestInitHelper
import kairo.domain.CaptureSessionId
import kairo.ingestion.IngestionPipeline
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
        val runtimeFactory = object : IngestionRuntimeFactory {
            override fun create(): IngestionPipeline =
                throw TransientIngestionException("Keep scheduler work pending in this test")
        }
        WorkManagerTestInitHelper.initializeTestWorkManager(
            context,
            Configuration.Builder()
                .setWorkerFactory(KairoWorkerFactory(runtimeFactory))
                .build(),
        )
        manager = WorkManager.getInstance(context)
    }

    @Test fun `enqueues one unique work item for a session`() {
        val sessionId = CaptureSessionId("work-session")
        val scheduler = IngestionWorkScheduler(manager)

        scheduler.enqueue(sessionId)
        scheduler.enqueue(sessionId)

        assertEquals(1, manager.getWorkInfosForUniqueWork("kairo-ingestion-work-session").get().size)
    }

    @Test fun `cancels unique ingestion work for a session`() {
        val sessionId = CaptureSessionId("cancel-session")
        val scheduler = IngestionWorkScheduler(manager)
        scheduler.enqueue(sessionId)

        scheduler.cancel(sessionId).result.get()

        assertEquals(
            WorkInfo.State.CANCELLED,
            manager.getWorkInfosForUniqueWork("kairo-ingestion-cancel-session").get().single().state,
        )
    }
}
