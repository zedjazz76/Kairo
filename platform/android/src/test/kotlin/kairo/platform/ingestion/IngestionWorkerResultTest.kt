package kairo.platform.ingestion

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.work.ListenableWorker
import androidx.work.testing.TestListenableWorkerBuilder
import androidx.work.workDataOf
import kairo.ingestion.IngestionPipeline
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import kotlin.test.assertEquals

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class IngestionWorkerResultTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()

    @Test
    fun `permanent runtime failure does not retry`() {
        val worker = workerWith(
            object : IngestionRuntimeFactory {
                override fun create(): IngestionPipeline = error("Permanent ingestion configuration failure")
            },
        )

        assertEquals(ListenableWorker.Result.failure(), worker.doWork())
    }

    @Test
    fun `explicit transient runtime failure retries`() {
        val worker = workerWith(
            object : IngestionRuntimeFactory {
                override fun create(): IngestionPipeline =
                    throw TransientIngestionException("Temporary database unavailability")
            },
        )

        assertEquals(ListenableWorker.Result.retry(), worker.doWork())
    }

    private fun workerWith(runtimeFactory: IngestionRuntimeFactory) =
        TestListenableWorkerBuilder<KairoIngestionWorker>(context)
            .setWorkerFactory(KairoWorkerFactory(runtimeFactory))
            .setInputData(workDataOf(IngestionWorkScheduler.SESSION_ID to "result-session"))
            .build()
}
