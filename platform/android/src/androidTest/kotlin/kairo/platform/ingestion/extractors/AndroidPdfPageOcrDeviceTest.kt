package kairo.platform.ingestion.extractors

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.ByteArrayOutputStream

@RunWith(AndroidJUnit4::class)
class AndroidPdfPageOcrDeviceTest {

    @Test
    fun renders_image_only_pdf_page_and_recognizes_text() {
        val context = ApplicationProvider.getApplicationContext<Context>()

        val result = AndroidPdfPageOcrEngine(
            context = context,
            imageOcr = MlKitImageOcrEngine(),
        ).recognize(
            pdfBytes = imageOnlyPdf(),
            page = 1,
        )

        assertTrue(
            "Expected scanned-PDF OCR to recognize PACS ONLINE; actual: ${result.text}",
            result.text.contains("PACS ONLINE", ignoreCase = true),
        )

        assertTrue(result.width > 0)
        assertTrue(result.height > 0)
        assertTrue(result.regions.isNotEmpty())
    }

    private fun imageOnlyPdf(): ByteArray {
        val image = Bitmap.createBitmap(
            1000,
            300,
            Bitmap.Config.ARGB_8888,
        )

        Canvas(image).apply {
            drawColor(Color.WHITE)

            drawText(
                "PACS ONLINE",
                60f,
                185f,
                Paint().apply {
                    color = Color.BLACK
                    textSize = 96f
                    isAntiAlias = true
                },
            )
        }

        val pdf = PdfDocument()

        try {
            val pageInfo = PdfDocument.PageInfo.Builder(
                1000,
                300,
                1,
            ).create()

            val page = pdf.startPage(pageInfo)
            page.canvas.drawBitmap(image, 0f, 0f, null)
            pdf.finishPage(page)

            return ByteArrayOutputStream().use { output ->
                pdf.writeTo(output)
                output.toByteArray()
            }
        } finally {
            image.recycle()
            pdf.close()
        }
    }
}
