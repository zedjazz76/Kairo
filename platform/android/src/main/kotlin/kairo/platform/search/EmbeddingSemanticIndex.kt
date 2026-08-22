package kairo.platform.search

import kairo.retrieval.SemanticIndex

fun interface TextEmbeddingProvider {
    fun embed(text: String): FloatArray
}

class EmbeddingSemanticIndex<T>(
    private val embeddingIndex: EmbeddingIndex,
    private val embeddingProvider: TextEmbeddingProvider,
    private val idOf: (T) -> String,
    private val textOf: (T) -> String,
) : SemanticIndex<T> {

    fun rebuild(
        candidates: List<T>,
    ) {
        embeddingIndex.rebuild(
            candidates.map { candidate ->
                EmbeddedDocument(
                    id = idOf(candidate),
                    vector = embeddingProvider.embed(
                        textOf(candidate),
                    ),
                )
            },
        )
    }

    override fun search(
        query: String,
        candidates: List<T>,
    ): List<T> {
        if (candidates.isEmpty()) {
            return emptyList()
        }

        val byId =
            candidates.associateBy(idOf)

        return embeddingIndex.search(
            queryVector = embeddingProvider.embed(query),
            limit = candidates.size,
        )
            .mapNotNull { match ->
                byId[match.id]
            }
    }
}
