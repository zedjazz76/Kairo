package kairo.retrieval

interface SemanticIndex<T> {
    fun search(
        query: String,
        candidates: List<T>,
    ): List<T>
}
