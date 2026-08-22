package kairo.platform.ingestion.extractors

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import kairo.domain.AnchorLocator
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.ingestion.ArtifactFormat
import kairo.ingestion.IngestionArtifact
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.ByteArrayOutputStream
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ImageExtractorTest {

    @Test
    fun `extracts visible image text with image region evidence`() {
        val artifact = IngestionArtifact(
            sourceId = SourceId("source-image"),
            variantId = SourceVariantId("variant-image"),
            fileName = "pacs-status.png",
            bytes = imageWithText(),
            mediaType = "image/png",
        )

        val extractor = ImageExtractor(
            ImageOcrEngine {
                OcrResult(
                    text = "PACS ONLINE",
                    width = 800,
                    height = 240,
                    regions = listOf(
                        OcrRegion(
                            text = "PACS ONLINE",
                            left = 0,
                            top = 0,
                            width = 800,
                            height = 240,
                        ),
                    ),
                )
            },
        )

        val extracted = extractor.extract(
            artifact,
            ArtifactFormat.PNG,
        )

        assertTrue(
            extracted.text.contains("PACS ONLINE", ignoreCase = true),
            "Expected OCR text to contain PACS ONLINE, got: ${extracted.text}",
        )

        assertTrue(extracted.anchors.isNotEmpty())

        val region = assertIs<AnchorLocator.ImageRegion>(
            extracted.anchors.first().locator,
        )

        assertEquals(0, region.left)
        assertEquals(0, region.top)
        assertTrue(region.width > 0)
        assertTrue(region.height > 0)
    }

    private fun imageWithText(): ByteArray {
        val bitmap = Bitmap.createBitmap(
            800,
            240,
            Bitmap.Config.ARGB_8888,
        )

        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)

        val paint = Paint().apply {
            color = Color.BLACK
            textSize = 72f
            isAntiAlias = true
        }

        canvas.drawText(
            "PACS ONLINE",
            40f,
            145f,
            paint,
        )

        val output = ByteArrayOutputStream()

        check(
            bitmap.compress(
                Bitmap.CompressFormat.PNG,
                100,
                output,
            ),
        )

        bitmap.recycle()

        return output.toByteArray()
    }
}
