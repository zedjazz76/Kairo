package kairo.platform.retrieval

import android.content.Context
import kairo.retrieval.IncompatibleSemanticIndexException
import kairo.retrieval.SearchDocument
import kairo.retrieval.SemanticIndexMetadata
import kairo.retrieval.requireCompatibleSemanticIndex
import java.io.File

class AndroidSearchIndex(
    context: Context,
    private val metadata: SemanticIndexMetadata? = null,
) {
    private val indexFile =
        File(context.filesDir, "kairo-derived-search-index.txt")

    private val metadataFile =
        File(context.filesDir, "kairo-derived-search-index.meta")

    fun rebuild(
        documents: List<SearchDocument>,
    ) {
        indexFile.parentFile?.mkdirs()

        indexFile.writeText(
            documents.joinToString("\n") { document ->
                encode(document.id) + "\t" + encode(document.text)
            },
        )

        metadata?.let(::writeMetadata)
    }

    fun clear() {
        if (indexFile.exists()) {
            indexFile.delete()
        }

        if (metadataFile.exists()) {
            metadataFile.delete()
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

        validatePersistedMetadata()

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


    private fun writeMetadata(
        value: SemanticIndexMetadata,
    ) {
        metadataFile.writeText(
            listOf(
                encode(value.model),
                encode(value.modelVersion),
                value.dimensions.toString(),
                encode(value.quantization),
                encode(value.contentHash),
            ).joinToString("\t"),
        )
    }

    private fun validatePersistedMetadata() {
        val expected = metadata ?: return

        if (!metadataFile.exists()) {
            throw IncompatibleSemanticIndexException(
                "Derived search index metadata is missing; rebuild required",
            )
        }

        val parts = metadataFile.readText()
            .split('\t')

        if (parts.size != 5) {
            throw IncompatibleSemanticIndexException(
                "Derived search index metadata is malformed; rebuild required",
            )
        }

        val actual = SemanticIndexMetadata(
            model = decode(parts[0]),
            modelVersion = decode(parts[1]),
            dimensions = parts[2].toIntOrNull()
                ?: throw IncompatibleSemanticIndexException(
                    "Derived search index dimensions are invalid; rebuild required",
                ),
            quantization = decode(parts[3]),
            contentHash = decode(parts[4]),
        )

        requireCompatibleSemanticIndex(
            expected = expected,
            actual = actual,
        )
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
