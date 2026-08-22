package kairo.platform.retrieval

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kairo.retrieval.SearchDocument
import kairo.retrieval.SemanticIndexMetadata
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidSearchIndexCompatibleMetadataDeviceTest {

    @Test
    fun compatiblePersistedMetadataAllowsSearchAfterReopen() {
        val context =
            ApplicationProvider.getApplicationContext<Context>()

        val metadata = SemanticIndexMetadata(
            model = "kairo-embed",
            modelVersion = "1",
            dimensions = 384,
            quantization = "FLOAT32",
            contentHash = "hash-a",
        )

        val firstIndex = AndroidSearchIndex(
            context = context,
            metadata = metadata,
        )

        firstIndex.clear()

        firstIndex.rebuild(
            listOf(
                SearchDocument(
                    id = "doc-pacs",
                    text = "Merge PACS hosts DMWL.",
                ),
                SearchDocument(
                    id = "doc-magview",
                    text = "MagView receives breast imaging studies.",
                ),
            ),
        )

        val reopenedIndex = AndroidSearchIndex(
            context = context,
            metadata = metadata,
        )

        val result = reopenedIndex
            .search("PACS DMWL")
            .map { it.id }

        assertEquals(
            listOf("doc-pacs"),
            result,
        )
    }
}
