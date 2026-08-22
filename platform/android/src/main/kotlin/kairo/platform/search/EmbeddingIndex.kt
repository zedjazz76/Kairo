package kairo.platform.search

import android.content.Context
import android.util.Base64
import kairo.retrieval.IncompatibleSemanticIndexException
import kairo.retrieval.SemanticIndexMetadata
import kairo.retrieval.requireCompatibleSemanticIndex
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import kotlin.math.sqrt

data class EmbeddedDocument(
    val id: String,
    val vector: FloatArray,
) {
    init {
        require(id.isNotBlank()) {
            "Embedded document id must not be blank"
        }
        require(vector.isNotEmpty()) {
            "Embedded document vector must not be empty"
        }
    }
}

data class SemanticMatch(
    val id: String,
    val score: Float,
)

class EmbeddingIndex(
    context: Context,
    private val metadata: SemanticIndexMetadata,
) {
    private val indexFile =
        File(context.filesDir, "kairo-embedding-index.bin")

    private val metadataFile =
        File(context.filesDir, "kairo-embedding-index.meta")

    fun rebuild(
        documents: List<EmbeddedDocument>,
    ) {
        documents.forEach { document ->
            require(document.vector.size == metadata.dimensions) {
                "Embedding dimensions must match index metadata"
            }
        }

        indexFile.parentFile?.mkdirs()

        DataOutputStream(
            BufferedOutputStream(
                indexFile.outputStream(),
            ),
        ).use { output ->
                documents.forEach { document ->
                    val idBytes =
                        document.id.toByteArray(Charsets.UTF_8)

                    output.writeInt(idBytes.size)
                    output.write(idBytes)

                    output.writeInt(document.vector.size)

                    document.vector.forEach { value ->
                        output.writeFloat(value)
                    }
                }
            }

        writeMetadata(metadata)
    }

    fun clear() {
        indexFile.delete()
        metadataFile.delete()
    }

    fun search(
        queryVector: FloatArray,
        limit: Int,
    ): List<SemanticMatch> {
        require(limit > 0) {
            "Search limit must be positive"
        }

        require(queryVector.size == metadata.dimensions) {
            "Query vector dimensions must match index metadata"
        }

        if (!indexFile.exists()) {
            return emptyList()
        }

        validatePersistedMetadata()

        return readDocuments()
            .map { document ->
                SemanticMatch(
                    id = document.id,
                    score = cosineSimilarity(
                        queryVector,
                        document.vector,
                    ),
                )
            }
            .sortedWith(
                compareByDescending<SemanticMatch> {
                    it.score
                }.thenBy {
                    it.id
                },
            )
            .take(limit)
    }

    private fun readDocuments(): List<EmbeddedDocument> {
        val documents =
            mutableListOf<EmbeddedDocument>()

        DataInputStream(
            BufferedInputStream(
                indexFile.inputStream(),
            ),
        ).use { input ->
                while (input.available() > 0) {
                    val idLength =
                        input.readInt()

                    require(idLength > 0) {
                        "Malformed embedding index id length"
                    }

                    val idBytes =
                        ByteArray(idLength)

                    input.readFully(idBytes)

                    val dimensions =
                        input.readInt()

                    require(dimensions == metadata.dimensions) {
                        "Persisted embedding dimensions are incompatible"
                    }

                    val vector =
                        FloatArray(dimensions) {
                            input.readFloat()
                        }

                    documents +=
                        EmbeddedDocument(
                            id = String(
                                idBytes,
                                Charsets.UTF_8,
                            ),
                            vector = vector,
                        )
                }
            }

        return documents
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
        if (!metadataFile.exists()) {
            throw IncompatibleSemanticIndexException(
                "Embedding index metadata missing; rebuild required",
            )
        }

        val parts =
            metadataFile.readText()
                .split('\t')

        if (parts.size != 5) {
            throw IncompatibleSemanticIndexException(
                "Embedding index metadata malformed; rebuild required",
            )
        }

        val actual =
            SemanticIndexMetadata(
                model = decode(parts[0]),
                modelVersion = decode(parts[1]),
                dimensions =
                    parts[2].toIntOrNull()
                        ?: throw IncompatibleSemanticIndexException(
                            "Embedding dimensions invalid; rebuild required",
                        ),
                quantization = decode(parts[3]),
                contentHash = decode(parts[4]),
            )

        requireCompatibleSemanticIndex(
            expected = metadata,
            actual = actual,
        )
    }

    private fun cosineSimilarity(
        left: FloatArray,
        right: FloatArray,
    ): Float {
        var dot = 0.0
        var leftMagnitude = 0.0
        var rightMagnitude = 0.0

        for (index in left.indices) {
            val leftValue =
                left[index].toDouble()

            val rightValue =
                right[index].toDouble()

            dot += leftValue * rightValue
            leftMagnitude += leftValue * leftValue
            rightMagnitude += rightValue * rightValue
        }

        if (
            leftMagnitude == 0.0 ||
            rightMagnitude == 0.0
        ) {
            return 0.0f
        }

        return (
            dot /
                (
                    sqrt(leftMagnitude) *
                        sqrt(rightMagnitude)
                    )
            ).toFloat()
    }

    private fun encode(
        value: String,
    ): String =
        Base64.encodeToString(
            value.toByteArray(Charsets.UTF_8),
            Base64.NO_WRAP,
        )

    private fun decode(
        value: String,
    ): String =
        String(
            Base64.decode(
                value,
                Base64.NO_WRAP,
            ),
            Charsets.UTF_8,
        )
}
