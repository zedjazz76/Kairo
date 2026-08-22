package kairo.platform.ingestion.extractors

import android.content.Context
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import java.io.ByteArrayOutputStream
import java.io.File

class AndroidPdfPageOcrEngine(
    private val context: Context,
    private val imageOcr: ImageOcrEngine,
) : PdfPageOcrEngine {

    override fun recognize(
        pdfBytes: ByteArray,
        page: Int,
    ): OcrResult {
        require(page > 0) {
            "PDF page must be positive"
        }

        val tempFile = File.createTempFile(
            "kairo-ocr-",
            ".pdf",
            context.cacheDir,
        )

        try {
            tempFile.writeBytes(pdfBytes)

            ParcelFileDescriptor.open(
                tempFile,
                ParcelFileDescriptor.MODE_READ_ONLY,
            ).use { descriptor ->
                PdfRenderer(descriptor).use { renderer ->
                    require(page <= renderer.pageCount) {
                        "Requested PDF page $page exceeds ${renderer.pageCount} pages"
                    }

                    renderer.openPage(page - 1).use { pdfPage ->
                        val scale = 2

                        val bitmap = Bitmap.createBitmap(
                            pdfPage.width * scale,
                            pdfPage.height * scale,
                            Bitmap.Config.ARGB_8888,
                        )

                        try {
                            bitmap.eraseColor(
                                android.graphics.Color.WHITE,
                            )

                            pdfPage.render(
                                bitmap,
                                null,
                                null,
                                PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY,
                            )

                            val pngBytes = ByteArrayOutputStream().use { output ->
                                check(
                                    bitmap.compress(
                                        Bitmap.CompressFormat.PNG,
                                        100,
                                        output,
                                    ),
                                )

                                output.toByteArray()
                            }

                            return imageOcr.recognize(pngBytes)
                        } finally {
                            bitmap.recycle()
                        }
                    }
                }
            }
        } finally {
            tempFile.delete()
        }
    }
}
