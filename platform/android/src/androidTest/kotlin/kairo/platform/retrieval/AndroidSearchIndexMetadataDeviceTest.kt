package kairo.platform.retrieval

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kairo.retrieval.IncompatibleSemanticIndexException
import kairo.retrieval.SearchDocument
import kairo.retrieval.SemanticIndexMetadata
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidSearchIndexMetadataDeviceTest {

    @Test
    fun incompatiblePersistedMetadataRequiresRebuild() {
        val context =
            ApplicationProvider.getApplicationContext<Context>()

        val originalMetadata = SemanticIndexMetadata(
            model = "kairo-embed",
            modelVersion = "1",
            dimensions = 384,
            quantization = "FLOAT32",
            contentHash = "hash-a",
        )

        val index = AndroidSearchIndex(
            context = context,
            metadata = originalMetadata,
        )

        index.clear()

        index.rebuild(
            listOf(
                SearchDocument(
                    id = "doc-pacs",
                    text = "Merge PACS hosts DMWL.",
                ),
            ),
        )

        val incompatible = AndroidSearchIndex(
            context = context,
            metadata = SemanticIndexMetadata(
                model = "kairo-embed",
                modelVersion = "2",
                dimensions = 768,
                quantization = "FLOAT32",
                contentHash = "hash-b",
            ),
        )

        val error = runCatching {
            incompatible.search("PACS DMWL")
        }.exceptionOrNull()

        assertEquals(
            IncompatibleSemanticIndexException::class.java,
            error?.javaClass,
        )
    }
}
