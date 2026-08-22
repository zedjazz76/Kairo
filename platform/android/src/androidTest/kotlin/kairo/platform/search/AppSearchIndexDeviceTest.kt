package kairo.platform.search

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kairo.retrieval.SearchDocument
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AppSearchIndexDeviceTest {

    @Test
    fun deleteAndRebuildProducesEquivalentResults() {
        val context =
            ApplicationProvider.getApplicationContext<Context>()

        val index = AppSearchIndex(context)

        val documents = listOf(
            SearchDocument(
                id = "doc-pacs",
                text = "Merge PACS hosts DMWL.",
            ),
            SearchDocument(
                id = "doc-magview",
                text = "MagView receives breast imaging studies.",
            ),
        )

        index.clear()
        index.rebuild(documents)

        val before = index.search("PACS DMWL")
            .map { it.id }

        index.clear()
        index.rebuild(documents)

        val after = index.search("PACS DMWL")
            .map { it.id }

        assertEquals(
            listOf("doc-pacs"),
            before,
        )

        assertEquals(
            before,
            after,
        )
    }
}
