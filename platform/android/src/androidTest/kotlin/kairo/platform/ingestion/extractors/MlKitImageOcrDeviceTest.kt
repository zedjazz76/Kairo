package kairo.platform.ingestion.extractors

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Test
import org.junit.runner.RunWith
import java.io.ByteArrayOutputStream
import org.junit.Assert.assertTrue

@RunWith(AndroidJUnit4::class)
class MlKitImageOcrDeviceTest {

    @Test
    fun recognizes_visible_text_from_png_pixels() {
        val bitmap = Bitmap.createBitmap(
            1000,
            300,
            Bitmap.Config.ARGB_8888,
        )

        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)

        val paint = Paint().apply {
            color = Color.BLACK
            textSize = 96f
            isAntiAlias = true
        }

        canvas.drawText(
            "PACS ONLINE",
            60f,
            185f,
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

        val result = MlKitImageOcrEngine()
            .recognize(output.toByteArray())

        assertTrue(
            "Expected OCR to recognize PACS ONLINE; actual text: ${result.text}",
            result.text.contains(
                "PACS ONLINE",
                ignoreCase = true,
            ),
        )

        assertTrue(result.width > 0)
        assertTrue(result.height > 0)
        assertTrue(result.regions.isNotEmpty())
    }
}
