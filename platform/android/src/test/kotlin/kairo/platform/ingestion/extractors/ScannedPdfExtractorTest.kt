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
class ScannedPdfExtractorTest {

    @Before
    fun initializePdfBox() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        PDFBoxResourceLoader.init(context)
    }

    @Test
    fun `OCRs scanned PDF page when embedded text is absent`() {
        val artifact = IngestionArtifact(
            sourceId = SourceId("source-scanned-pdf"),
            variantId = SourceVariantId("variant-scanned-pdf"),
            fileName = "scanned.pdf",
            bytes = minimalBlankPdf(),
            mediaType = "application/pdf",
        )

        val extractor = PdfExtractor(
            pageOcr = PdfPageOcrEngine { _, page ->
                check(page == 1)

                OcrResult(
                    text = "SCANNED PACS WORKFLOW",
                    width = 612,
                    height = 792,
                    regions = listOf(
                        OcrRegion(
                            text = "SCANNED PACS WORKFLOW",
                            left = 20,
                            top = 30,
                            width = 400,
                            height = 80,
                        ),
                    ),
                )
            },
        )

        val extracted = extractor.extract(
            artifact,
            ArtifactFormat.PDF,
        )

        assertTrue(
            extracted.text.contains("SCANNED PACS WORKFLOW"),
        )

        assertEquals(1, extracted.anchors.size)

        val anchor = assertIs<AnchorLocator.PdfPageBox>(
            extracted.anchors.single().locator,
        )

        assertEquals(1, anchor.page)
    }

    private fun minimalBlankPdf(): ByteArray =
        """
        %PDF-1.4
        1 0 obj
        << /Type /Catalog /Pages 2 0 R >>
        endobj
        2 0 obj
        << /Type /Pages /Kids [3 0 R] /Count 1 >>
        endobj
        3 0 obj
        << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
        endobj
        xref
        0 4
        0000000000 65535 f
        0000000009 00000 n
        0000000058 00000 n
        0000000115 00000 n
        trailer
        << /Size 4 /Root 1 0 R >>
        startxref
        186
        %%EOF
        """.trimIndent().toByteArray(Charsets.US_ASCII)
}
