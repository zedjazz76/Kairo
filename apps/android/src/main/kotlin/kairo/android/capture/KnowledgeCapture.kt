package kairo.android.capture

data class KnowledgeCaptureRequest(
    val subject: String,
    val predicate: String,
    val value: String,
)

fun interface KnowledgeCapture {
    suspend fun save(
        request: KnowledgeCaptureRequest,
    )
}
