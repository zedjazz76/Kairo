package kairo.platform.ingestion.extractors

import kairo.domain.AnchorLocator
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.ingestion.ArtifactFormat
import kairo.ingestion.IngestionArtifact
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class XlsxExtractorTest {

    @Test
    fun `extracts worksheet values with sheet range evidence`() {
        val artifact = IngestionArtifact(
            sourceId = SourceId("source-xlsx"),
            variantId = SourceVariantId("variant-xlsx"),
            fileName = "systems.xlsx",
            bytes = simpleXlsx(),
            mediaType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        val extracted = XlsxExtractor().extract(
            artifact,
            ArtifactFormat.XLSX,
        )

        assertTrue(extracted.text.contains("System"))
        assertTrue(extracted.text.contains("Status"))
        assertTrue(extracted.text.contains("Merge PACS"))
        assertTrue(extracted.text.contains("Production"))

        assertEquals(1, extracted.anchors.size)

        val anchor = assertIs<AnchorLocator.SheetRange>(
            extracted.anchors.single().locator,
        )

        assertEquals("Systems", anchor.sheet)
        assertEquals(1, anchor.firstRow)
        assertEquals(1, anchor.firstColumn)
        assertEquals(2, anchor.lastRow)
        assertEquals(2, anchor.lastColumn)
    }

    private fun simpleXlsx(): ByteArray {
        val output = ByteArrayOutputStream()

        ZipOutputStream(output).use { zip ->
            fun entry(name: String, content: String) {
                zip.putNextEntry(ZipEntry(name))
                zip.write(content.trimIndent().toByteArray())
                zip.closeEntry()
            }

            entry(
                "xl/workbook.xml",
                """
                <?xml version="1.0" encoding="UTF-8"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
                    xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                  <sheets>
                    <sheet name="Systems" sheetId="1" r:id="rId1"/>
                  </sheets>
                </workbook>
                """,
            )

            entry(
                "xl/_rels/workbook.xml.rels",
                """
                <?xml version="1.0" encoding="UTF-8"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship
                    Id="rId1"
                    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"
                    Target="worksheets/sheet1.xml"/>
                </Relationships>
                """,
            )

            entry(
                "xl/worksheets/sheet1.xml",
                """
                <?xml version="1.0" encoding="UTF-8"?>
                <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                  <sheetData>
                    <row r="1">
                      <c r="A1" t="inlineStr"><is><t>System</t></is></c>
                      <c r="B1" t="inlineStr"><is><t>Status</t></is></c>
                    </row>
                    <row r="2">
                      <c r="A2" t="inlineStr"><is><t>Merge PACS</t></is></c>
                      <c r="B2" t="inlineStr"><is><t>Production</t></is></c>
                    </row>
                  </sheetData>
                </worksheet>
                """,
            )
        }

        return output.toByteArray()
    }
}
