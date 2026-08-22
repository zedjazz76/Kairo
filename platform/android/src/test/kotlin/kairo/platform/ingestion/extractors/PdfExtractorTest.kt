package kairo.platform.ingestion.extractors

import kairo.domain.AnchorLocator
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.ingestion.ArtifactFormat
import kairo.ingestion.IngestionArtifact
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class PdfExtractorTest {

    @Before
    fun initializePdfBox() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        PDFBoxResourceLoader.init(context)
    }

    @Test
    fun `extracts text and retains an anchor for each PDF page`() {
        val artifact = IngestionArtifact(
            sourceId = SourceId("source-pdf"),
            variantId = SourceVariantId("variant-pdf"),
            fileName = "two-pages.pdf",
            bytes = twoPagePdf(),
            mediaType = "application/pdf",
        )

        val extracted = PdfExtractor().extract(artifact, ArtifactFormat.PDF)

        assertTrue(extracted.text.contains("Kairo Page One"))
        assertTrue(extracted.text.contains("Kairo Page Two"))

        assertEquals(2, extracted.anchors.size)

        val pageAnchors = extracted.anchors
            .map { assertIs<AnchorLocator.PdfPageBox>(it.locator) }
            .sortedBy { it.page }

        assertEquals(listOf(1, 2), pageAnchors.map { it.page })
        assertTrue(pageAnchors.all { it.right > it.left })
        assertTrue(pageAnchors.all { it.bottom > it.top })
    }

    private fun twoPagePdf(): ByteArray {
        val objects = listOf(
            """1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
""",
            """2 0 obj
<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>
endobj
""",
            """3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>
endobj
""",
            """4 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>
endobj
""",
            """5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
""",
            streamObject("BT /F1 18 Tf 72 720 Td (Kairo Page One) Tj ET"),
            streamObject("BT /F1 18 Tf 72 720 Td (Kairo Page Two) Tj ET"),
        )

        val output = StringBuilder("%PDF-1.4\n")
        val offsets = mutableListOf<Int>()

        objects.forEach { obj ->
            offsets += output.toString().toByteArray(Charsets.US_ASCII).size
            output.append(obj)
        }

        val xrefOffset = output.toString().toByteArray(Charsets.US_ASCII).size

        output.append("xref\n")
        output.append("0 ${objects.size + 1}\n")
        output.append("0000000000 65535 f \n")

        offsets.forEach { offset ->
            output.append(String.format("%010d 00000 n \n", offset))
        }

        output.append(
            """trailer
<< /Size ${objects.size + 1} /Root 1 0 R >>
startxref
$xrefOffset
%%EOF
""",
        )

        return output.toString().toByteArray(Charsets.US_ASCII)
    }

    private fun streamObject(content: String): String =
        """${if (content.contains("Page One")) "6" else "7"} 0 obj
<< /Length ${content.toByteArray(Charsets.US_ASCII).size} >>
stream
$content
endstream
endobj
"""
}
