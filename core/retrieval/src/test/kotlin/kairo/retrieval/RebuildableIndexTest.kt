package kairo.retrieval

import kotlin.test.Test
import kotlin.test.assertEquals

class RebuildableIndexTest {

    @Test
    fun `derived index rebuild reproduces equivalent retrieval results`() {
        val source = listOf(
            SearchDocument(
                id = "doc-1",
                text = "Merge PACS hosts DMWL.",
            ),
            SearchDocument(
                id = "doc-2",
                text = "MagView receives breast imaging studies.",
            ),
        )

        val index = InMemoryLexicalIndex()

        index.rebuild(source)

        val before = index.search("PACS DMWL")

        index.clear()
        index.rebuild(source)

        val after = index.search("PACS DMWL")

        assertEquals(
            before.map { it.id },
            after.map { it.id },
        )
    }
}
