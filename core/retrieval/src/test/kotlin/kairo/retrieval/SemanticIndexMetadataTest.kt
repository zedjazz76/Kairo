package kairo.retrieval

import kotlin.test.Test
import kotlin.test.assertFailsWith

class SemanticIndexMetadataTest {

    @Test
    fun `mixed incompatible semantic index metadata is rejected`() {
        val expected = SemanticIndexMetadata(
            model = "kairo-embed",
            modelVersion = "1",
            dimensions = 384,
            quantization = "FLOAT32",
            contentHash = "hash-a",
        )

        val actual = SemanticIndexMetadata(
            model = "kairo-embed",
            modelVersion = "2",
            dimensions = 768,
            quantization = "FLOAT32",
            contentHash = "hash-b",
        )

        assertFailsWith<IncompatibleSemanticIndexException> {
            requireCompatibleSemanticIndex(
                expected = expected,
                actual = actual,
            )
        }
    }

    @Test
    fun `matching semantic index metadata is accepted`() {
        val metadata = SemanticIndexMetadata(
            model = "kairo-embed",
            modelVersion = "1",
            dimensions = 384,
            quantization = "FLOAT32",
            contentHash = "hash-a",
        )

        requireCompatibleSemanticIndex(
            expected = metadata,
            actual = metadata,
        )
    }
}
