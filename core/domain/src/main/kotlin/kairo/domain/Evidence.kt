package kairo.domain

data class EvidenceRef(
    val sourceId: String,
    val anchor: String? = null,
    val extractionConfidence: Double? = null,
) {
    init {
        require(sourceId.isNotBlank()) { "Evidence sourceId must not be blank" }
        require(extractionConfidence == null || extractionConfidence in 0.0..1.0) {
            "Extraction confidence must be between 0.0 and 1.0"
        }
    }
}
