package kairo.retrieval

data class SemanticIndexMetadata(
    val model: String,
    val modelVersion: String,
    val dimensions: Int,
    val quantization: String,
    val contentHash: String,
) {
    init {
        require(model.isNotBlank()) { "Semantic index model must not be blank" }
        require(modelVersion.isNotBlank()) { "Semantic index modelVersion must not be blank" }
        require(dimensions > 0) { "Semantic index dimensions must be positive" }
        require(quantization.isNotBlank()) { "Semantic index quantization must not be blank" }
        require(contentHash.isNotBlank()) { "Semantic index contentHash must not be blank" }
    }
}

class IncompatibleSemanticIndexException(
    message: String,
) : IllegalArgumentException(message)

fun requireCompatibleSemanticIndex(
    expected: SemanticIndexMetadata,
    actual: SemanticIndexMetadata,
) {
    if (expected != actual) {
        throw IncompatibleSemanticIndexException(
            buildString {
                append("Semantic index metadata mismatch.")
                append(" Expected=")
                append(expected)
                append(" Actual=")
                append(actual)
            },
        )
    }
}
