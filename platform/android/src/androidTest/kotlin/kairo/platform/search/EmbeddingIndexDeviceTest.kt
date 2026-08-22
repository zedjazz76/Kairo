package kairo.platform.search

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kairo.retrieval.SemanticIndexMetadata
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class EmbeddingIndexDeviceTest {

    @Test
    fun nearestSemanticVectorSurvivesReopenAndRebuild() {
        val context =
            ApplicationProvider.getApplicationContext<Context>()

        val metadata = SemanticIndexMetadata(
            model = "kairo-test-embed",
            modelVersion = "1",
            dimensions = 3,
            quantization = "FLOAT32",
            contentHash = "fixture-v1",
        )

        val index = EmbeddingIndex(
            context = context,
            metadata = metadata,
        )

        val vectors = listOf(
            EmbeddedDocument(
                id = "routing-incident",
                vector = floatArrayOf(1.0f, 0.0f, 0.0f),
            ),
            EmbeddedDocument(
                id = "unrelated",
                vector = floatArrayOf(0.0f, 1.0f, 0.0f),
            ),
        )

        index.clear()
        index.rebuild(vectors)

        val before = index.search(
            queryVector = floatArrayOf(0.9f, 0.1f, 0.0f),
            limit = 1,
        )

        val reopened = EmbeddingIndex(
            context = context,
            metadata = metadata,
        )

        val afterReopen = reopened.search(
            queryVector = floatArrayOf(0.9f, 0.1f, 0.0f),
            limit = 1,
        )

        reopened.clear()
        reopened.rebuild(vectors)

        val afterRebuild = reopened.search(
            queryVector = floatArrayOf(0.9f, 0.1f, 0.0f),
            limit = 1,
        )

        assertEquals(
            "routing-incident",
            before.single().id,
        )

        assertEquals(
            before.map { it.id },
            afterReopen.map { it.id },
        )

        assertEquals(
            before.map { it.id },
            afterRebuild.map { it.id },
        )
    }
}
