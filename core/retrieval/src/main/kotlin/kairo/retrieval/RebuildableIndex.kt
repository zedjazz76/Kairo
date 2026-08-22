package kairo.retrieval

data class SearchDocument(
    val id: String,
    val text: String,
) {
    init {
        require(id.isNotBlank()) { "Search document id must not be blank" }
        require(text.isNotBlank()) { "Search document text must not be blank" }
    }
}

class InMemoryLexicalIndex {
    private var documents: List<SearchDocument> = emptyList()

    fun rebuild(source: List<SearchDocument>) {
        documents = source.toList()
    }

    fun clear() {
        documents = emptyList()
    }

    fun search(query: String): List<SearchDocument> {
        require(query.isNotBlank()) { "Search query must not be blank" }

        val queryTokens = tokenize(query)

        return documents
            .map { document ->
                document to queryTokens.count { token ->
                    document.text.lowercase().contains(token)
                }
            }
            .filter { (_, score) -> score > 0 }
            .sortedWith(
                compareByDescending<Pair<SearchDocument, Int>> { it.second }
                    .thenBy { it.first.id },
            )
            .map { it.first }
    }

    private fun tokenize(text: String): Set<String> =
        text
            .lowercase()
            .split(Regex("[^a-z0-9]+"))
            .filter { it.length > 1 }
            .toSet()
}
