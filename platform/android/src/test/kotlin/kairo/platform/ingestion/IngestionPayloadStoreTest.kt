package kairo.platform.ingestion

import kairo.domain.AnchorLocator
import kairo.domain.CaptureSessionId
import kairo.domain.SourceAnchor
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.ingestion.ArtifactFormat
import kairo.ingestion.ExtractedArtifact
import kairo.ingestion.IngestionArtifact
import kairo.platform.vault.CacheBackedTemporarySessionStore
import kairo.platform.vault.FixedMasterKeyProvider
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import javax.crypto.spec.SecretKeySpec
import kotlin.test.assertEquals
import kotlin.test.assertContentEquals
import kotlin.test.assertNotNull

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class IngestionPayloadStoreTest {
    @get:Rule val temporaryFolder = TemporaryFolder()

    @Test
    fun `encrypted extraction payload round trips every evidence anchor type`() {
        val sourceId = SourceId("anchor-source")
        val variantId = SourceVariantId("anchor-variant")
        val artifact = IngestionArtifact(sourceId, variantId, "evidence.pdf", byteArrayOf(1))
        val anchors = linkedSetOf(
            SourceAnchor(sourceId, variantId, AnchorLocator.PdfPageBox(1, 0.0, 0.0, 612.0, 792.0)),
            SourceAnchor(sourceId, variantId, AnchorLocator.ImageRegion(10, 20, 30, 40)),
            SourceAnchor(sourceId, variantId, AnchorLocator.SheetRange("Systems", 1, 1, 2, 3)),
            SourceAnchor(sourceId, variantId, AnchorLocator.TextSpan(0, 11)),
            SourceAnchor(sourceId, variantId, AnchorLocator.ChatTurn("capture-chat", 1, 0, 11)),
        )
        val extracted = ExtractedArtifact(artifact, ArtifactFormat.PDF, "PACS ONLINE", anchors)
        val store = TemporarySessionIngestionPayloadStore(
            CacheBackedTemporarySessionStore(
                temporaryFolder.newFolder("payloads").toPath(),
                FixedMasterKeyProvider(SecretKeySpec(ByteArray(32) { (it + 1).toByte() }, "AES")),
            ),
        )

        val reference = store.storeExtraction(CaptureSessionId("anchor-session"), extracted)

        val restored = assertNotNull(store.loadExtraction(reference))
        assertEquals(extracted.format, restored.format)
        assertEquals(extracted.text, restored.text)
        assertEquals(extracted.anchors, restored.anchors)
        assertEquals(artifact.sourceId, restored.artifact.sourceId)
        assertEquals(artifact.variantId, restored.artifact.variantId)
        assertEquals(artifact.fileName, restored.artifact.fileName)
        assertContentEquals(artifact.bytes, restored.artifact.bytes)
    }
}
