package kairo.platform.ingestion.extractors

import android.graphics.BitmapFactory
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

data class OcrRegion(
    val text: String,
    val left: Int,
    val top: Int,
    val width: Int,
    val height: Int,
)

data class OcrResult(
    val text: String,
    val width: Int,
    val height: Int,
    val regions: List<OcrRegion>,
)

fun interface ImageOcrEngine {
    fun recognize(bytes: ByteArray): OcrResult
}

class MlKitImageOcrEngine : ImageOcrEngine {

    override fun recognize(bytes: ByteArray): OcrResult {
        val bitmap = requireNotNull(
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size),
        ) {
            "Image artifact could not be decoded"
        }

        try {
            val recognizer = TextRecognition.getClient(
                TextRecognizerOptions.DEFAULT_OPTIONS,
            )

            try {
                val result = Tasks.await(
                    recognizer.process(
                        InputImage.fromBitmap(bitmap, 0),
                    ),
                )

                val regions = result.textBlocks.mapNotNull { block ->
                    val box = block.boundingBox ?: return@mapNotNull null

                    if (box.width() <= 0 || box.height() <= 0) {
                        return@mapNotNull null
                    }

                    OcrRegion(
                        text = block.text,
                        left = box.left.coerceAtLeast(0),
                        top = box.top.coerceAtLeast(0),
                        width = box.width(),
                        height = box.height(),
                    )
                }

                return OcrResult(
                    text = result.text.trim(),
                    width = bitmap.width,
                    height = bitmap.height,
                    regions = regions,
                )
            } finally {
                recognizer.close()
            }
        } finally {
            bitmap.recycle()
        }
    }
}

fun interface PdfPageOcrEngine {
    fun recognize(pdfBytes: ByteArray, page: Int): OcrResult
}
