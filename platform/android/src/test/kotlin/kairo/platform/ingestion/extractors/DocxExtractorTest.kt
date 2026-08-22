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

class DocxExtractorTest {

    @Test
    fun `extracts clean document text without leaking DOCX package markup`() {
        val artifact = IngestionArtifact(
            sourceId = SourceId("source-docx"),
            variantId = SourceVariantId("variant-docx"),
            fileName = "workflow.docx",
            bytes = simpleDocx(),
            mediaType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

        val extracted = DocxExtractor().extract(artifact, ArtifactFormat.DOCX)

        assertTrue(extracted.text.contains("AbbaDox Workflow"))
        assertTrue(extracted.text.contains("Orders flow from RIS to PACS."))

        assertTrue(!extracted.text.contains("word/document.xml"))
        assertTrue(!extracted.text.contains("w:document"))
        assertTrue(!extracted.text.contains("[Content_Types]"))

        assertEquals(1, extracted.anchors.size)

        val anchor = assertIs<AnchorLocator.TextSpan>(
            extracted.anchors.single().locator,
        )

        assertEquals(0, anchor.startOffset)
        assertEquals(extracted.text.length, anchor.endOffset)
    }

    private fun simpleDocx(): ByteArray {
        val output = ByteArrayOutputStream()

        ZipOutputStream(output).use { zip ->
            zip.putNextEntry(ZipEntry("[Content_Types].xml"))
            zip.write(
                """
                <?xml version="1.0" encoding="UTF-8"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                  <Default Extension="xml" ContentType="application/xml"/>
                  <Override PartName="/word/document.xml"
                    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
                </Types>
                """.trimIndent().toByteArray(),
            )
            zip.closeEntry()

            zip.putNextEntry(ZipEntry("_rels/.rels"))
            zip.write(
                """
                <?xml version="1.0" encoding="UTF-8"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship
                    Id="rId1"
                    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
                    Target="word/document.xml"/>
                </Relationships>
                """.trimIndent().toByteArray(),
            )
            zip.closeEntry()

            zip.putNextEntry(ZipEntry("word/document.xml"))
            zip.write(
                """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <w:document
                  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                  <w:body>
                    <w:p>
                      <w:r><w:t>AbbaDox Workflow</w:t></w:r>
                    </w:p>
                    <w:p>
                      <w:r><w:t>Orders flow from RIS to PACS.</w:t></w:r>
                    </w:p>
                  </w:body>
                </w:document>
                """.trimIndent().toByteArray(),
            )
            zip.closeEntry()
        }

        return output.toByteArray()
    }
}
