package kairo.platform.retrieval

import android.content.Context
import kairo.retrieval.SearchDocument
import java.io.File

class AndroidSearchIndex(
    context: Context,
) {
    private val indexFile =
        File(context.filesDir, "kairo-derived-search-index.txt")

    fun rebuild(
        documents: List<SearchDocument>,
    ) {
        indexFile.parentFile?.mkdirs()

        indexFile.writeText(
            documents.joinToString("\n") { document ->
                encode(document.id) + "\t" + encode(document.text)
            },
        )
    }

    fun clear() {
        if (indexFile.exists()) {
            indexFile.delete()
        }
    }

    fun search(
        query: String,
    ): List<SearchDocument> {
        require(query.isNotBlank()) {
            "Search query must not be blank"
        }

        if (!indexFile.exists()) {
            return emptyList()
        }

        val queryTokens = tokenize(query)

        return indexFile
            .readLines()
            .filter { it.isNotBlank() }
            .map(::decodeDocument)
            .map { document ->
                document to queryTokens.count { token ->
                    document.text
                        .lowercase()
                        .contains(token)
                }
            }
            .filter { (_, score) ->
                score > 0
            }
            .sortedWith(
                compareByDescending<Pair<SearchDocument, Int>> {
                    it.second
                }.thenBy {
                    it.first.id
                },
            )
            .map {
                it.first
            }
    }

    private fun decodeDocument(
        line: String,
    ): SearchDocument {
        val parts = line.split('\t', limit = 2)

        require(parts.size == 2) {
            "Malformed derived search index row"
        }

        return SearchDocument(
            id = decode(parts[0]),
            text = decode(parts[1]),
        )
    }

    private fun encode(
        value: String,
    ): String =
        android.util.Base64.encodeToString(
            value.toByteArray(Charsets.UTF_8),
            android.util.Base64.NO_WRAP,
        )

    private fun decode(
        value: String,
    ): String =
        String(
            android.util.Base64.decode(
                value,
                android.util.Base64.NO_WRAP,
            ),
            Charsets.UTF_8,
        )

    private fun tokenize(
        text: String,
    ): Set<String> =
        text
            .lowercase()
            .split(Regex("[^a-z0-9]+"))
            .filter {
                it.length > 1
            }
            .toSet()
}
