package kairo.platform.ingestion.extractors

import kairo.domain.AnchorLocator
import kairo.domain.SourceAnchor
import kairo.ingestion.ArtifactExtractor
import kairo.ingestion.ArtifactFormat
import kairo.ingestion.ExtractedArtifact
import kairo.ingestion.IngestionArtifact

/**
 * Small local extractors used for text-bearing artifacts. Rich layout and OCR engines
 * can be substituted behind [ArtifactExtractor] without changing pipeline contracts.
 */
abstract class LocalTextExtractor(private vararg val formats: ArtifactFormat) : ArtifactExtractor {
    override fun supports(format: ArtifactFormat): Boolean = format in formats

    override fun extract(artifact: IngestionArtifact, format: ArtifactFormat): ExtractedArtifact {
        val text = extractText(artifact.bytes).ifBlank { "[No extractable text in ${artifact.fileName}]" }
        return ExtractedArtifact(
            artifact = artifact,
            format = format,
            text = text,
            anchors = setOf(
                SourceAnchor(artifact.sourceId, artifact.variantId, AnchorLocator.TextSpan(0, text.length)),
            ),
        )
    }

    protected open fun extractText(bytes: ByteArray): String = bytes.decodeToString()
}

class PdfExtractor : ArtifactExtractor {

    override fun supports(format: ArtifactFormat): Boolean =
        format == ArtifactFormat.PDF

    override fun extract(
        artifact: IngestionArtifact,
        format: ArtifactFormat,
    ): ExtractedArtifact {
        require(format == ArtifactFormat.PDF) {
            "PdfExtractor only supports PDF artifacts"
        }

        com.tom_roush.pdfbox.pdmodel.PDDocument.load(artifact.bytes).use { document ->
            val textParts = mutableListOf<String>()
            val anchors = linkedSetOf<SourceAnchor>()

            for (pageIndex in 0 until document.numberOfPages) {
                val pageNumber = pageIndex + 1
                val stripper = com.tom_roush.pdfbox.text.PDFTextStripper().apply {
                    startPage = pageNumber
                    endPage = pageNumber
                }

                val pageText = stripper.getText(document).trim()
                if (pageText.isNotBlank()) {
                    textParts += pageText
                }

                val mediaBox = document.getPage(pageIndex).mediaBox

                anchors += SourceAnchor(
                    sourceId = artifact.sourceId,
                    variantId = artifact.variantId,
                    locator = AnchorLocator.PdfPageBox(
                        page = pageNumber,
                        left = mediaBox.lowerLeftX.toDouble(),
                        top = mediaBox.lowerLeftY.toDouble(),
                        right = mediaBox.upperRightX.toDouble(),
                        bottom = mediaBox.upperRightY.toDouble(),
                    ),
                )
            }

            val text = textParts.joinToString("\n\n")
                .ifBlank { "[No extractable text in ${artifact.fileName}]" }

            return ExtractedArtifact(
                artifact = artifact,
                format = format,
                text = text,
                anchors = anchors,
            )
        }
    }
}

class DocxExtractor : ArtifactExtractor {

    override fun supports(format: ArtifactFormat): Boolean =
        format == ArtifactFormat.DOCX

    override fun extract(
        artifact: IngestionArtifact,
        format: ArtifactFormat,
    ): ExtractedArtifact {
        require(format == ArtifactFormat.DOCX) {
            "DocxExtractor only supports DOCX artifacts"
        }

        val documentXml = java.util.zip.ZipInputStream(
            artifact.bytes.inputStream(),
        ).use { zip ->
            var xml: ByteArray? = null

            while (true) {
                val entry = zip.nextEntry ?: break

                if (entry.name == "word/document.xml") {
                    xml = zip.readBytes()
                    break
                }
            }

            requireNotNull(xml) {
                "DOCX artifact does not contain word/document.xml"
            }
        }

        val factory = javax.xml.parsers.DocumentBuilderFactory.newInstance().apply {
            isNamespaceAware = true
        }

        val document = factory.newDocumentBuilder()
            .parse(documentXml.inputStream())

        val wordNamespace =
            "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

        val paragraphs = document
            .getElementsByTagNameNS(wordNamespace, "p")

        val extractedParagraphs = buildList {
            for (index in 0 until paragraphs.length) {
                val paragraph = paragraphs.item(index)
                val textNodes = (paragraph as org.w3c.dom.Element)
                    .getElementsByTagNameNS(wordNamespace, "t")

                val paragraphText = buildString {
                    for (textIndex in 0 until textNodes.length) {
                        append(textNodes.item(textIndex).textContent)
                    }
                }.trim()

                if (paragraphText.isNotBlank()) {
                    add(paragraphText)
                }
            }
        }

        val text = extractedParagraphs
            .joinToString("\n")
            .ifBlank {
                "[No extractable text in ${artifact.fileName}]"
            }

        return ExtractedArtifact(
            artifact = artifact,
            format = format,
            text = text,
            anchors = setOf(
                SourceAnchor(
                    artifact.sourceId,
                    artifact.variantId,
                    AnchorLocator.TextSpan(0, text.length),
                ),
            ),
        )
    }
}

class XlsxExtractor : ArtifactExtractor {

    override fun supports(format: ArtifactFormat): Boolean =
        format == ArtifactFormat.XLSX

    override fun extract(
        artifact: IngestionArtifact,
        format: ArtifactFormat,
    ): ExtractedArtifact {
        require(format == ArtifactFormat.XLSX) {
            "XlsxExtractor only supports XLSX artifacts"
        }

        val entries = linkedMapOf<String, ByteArray>()

        java.util.zip.ZipInputStream(
            artifact.bytes.inputStream(),
        ).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                if (!entry.isDirectory) {
                    entries[entry.name] = zip.readBytes()
                }
            }
        }

        val workbookXml = requireNotNull(entries["xl/workbook.xml"]) {
            "XLSX artifact does not contain xl/workbook.xml"
        }

        val relationshipsXml =
            requireNotNull(entries["xl/_rels/workbook.xml.rels"]) {
                "XLSX artifact does not contain workbook relationships"
            }

        fun parseXml(bytes: ByteArray): org.w3c.dom.Document {
            val factory = javax.xml.parsers.DocumentBuilderFactory
                .newInstance()
                .apply { isNamespaceAware = true }

            return factory.newDocumentBuilder()
                .parse(bytes.inputStream())
        }

        val relationshipDocument = parseXml(relationshipsXml)
        val relationshipNodes = relationshipDocument.getElementsByTagNameNS(
            "http://schemas.openxmlformats.org/package/2006/relationships",
            "Relationship",
        )

        val targetsById = mutableMapOf<String, String>()

        for (index in 0 until relationshipNodes.length) {
            val relationship =
                relationshipNodes.item(index) as org.w3c.dom.Element

            targetsById[relationship.getAttribute("Id")] =
                relationship.getAttribute("Target")
        }

        val workbookDocument = parseXml(workbookXml)
        val sheetNodes = workbookDocument.getElementsByTagNameNS(
            "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
            "sheet",
        )

        val textParts = mutableListOf<String>()
        val anchors = linkedSetOf<SourceAnchor>()

        for (sheetIndex in 0 until sheetNodes.length) {
            val sheet = sheetNodes.item(sheetIndex) as org.w3c.dom.Element

            val sheetName = sheet.getAttribute("name")
            val relationshipId = sheet.getAttributeNS(
                "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
                "id",
            )

            val target = requireNotNull(targetsById[relationshipId]) {
                "Worksheet relationship $relationshipId does not resolve"
            }

            val normalizedTarget = if (target.startsWith("/")) {
                target.removePrefix("/")
            } else {
                "xl/${target.removePrefix("./")}"
            }

            val sheetXml = requireNotNull(entries[normalizedTarget]) {
                "XLSX worksheet $normalizedTarget is missing"
            }

            val sheetDocument = parseXml(sheetXml)
            val cellNodes = sheetDocument.getElementsByTagNameNS(
                "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
                "c",
            )

            var firstRow = Int.MAX_VALUE
            var firstColumn = Int.MAX_VALUE
            var lastRow = 0
            var lastColumn = 0

            val rows = linkedMapOf<Int, MutableList<Pair<Int, String>>>()

            for (cellIndex in 0 until cellNodes.length) {
                val cell = cellNodes.item(cellIndex) as org.w3c.dom.Element
                val reference = cell.getAttribute("r")

                val match = Regex("""([A-Z]+)(\d+)""").matchEntire(reference)
                    ?: continue

                val columnLetters = match.groupValues[1]
                val row = match.groupValues[2].toInt()

                var column = 0
                for (character in columnLetters) {
                    column = column * 26 + (character - 'A' + 1)
                }

                val type = cell.getAttribute("t")

                val value = when (type) {
                    "inlineStr" -> {
                        val textNodes = cell.getElementsByTagNameNS(
                            "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
                            "t",
                        )

                        buildString {
                            for (textIndex in 0 until textNodes.length) {
                                append(textNodes.item(textIndex).textContent)
                            }
                        }
                    }

                    else -> {
                        val valueNodes = cell.getElementsByTagNameNS(
                            "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
                            "v",
                        )

                        if (valueNodes.length > 0) {
                            valueNodes.item(0).textContent
                        } else {
                            ""
                        }
                    }
                }.trim()

                if (value.isNotBlank()) {
                    rows.getOrPut(row) { mutableListOf() }
                        .add(column to value)

                    firstRow = minOf(firstRow, row)
                    firstColumn = minOf(firstColumn, column)
                    lastRow = maxOf(lastRow, row)
                    lastColumn = maxOf(lastColumn, column)
                }
            }

            val sheetText = rows
                .toSortedMap()
                .values
                .joinToString("\n") { cells ->
                    cells.sortedBy { it.first }
                        .joinToString("\t") { it.second }
                }

            if (sheetText.isNotBlank()) {
                textParts += "$sheetName\n$sheetText"

                anchors += SourceAnchor(
                    sourceId = artifact.sourceId,
                    variantId = artifact.variantId,
                    locator = AnchorLocator.SheetRange(
                        sheet = sheetName,
                        firstRow = firstRow,
                        firstColumn = firstColumn,
                        lastRow = lastRow,
                        lastColumn = lastColumn,
                    ),
                )
            }
        }

        val text = textParts
            .joinToString("\n\n")
            .ifBlank {
                "[No extractable text in ${artifact.fileName}]"
            }

        return ExtractedArtifact(
            artifact = artifact,
            format = format,
            text = text,
            anchors = anchors.ifEmpty {
                setOf(
                    SourceAnchor(
                        artifact.sourceId,
                        artifact.variantId,
                        AnchorLocator.TextSpan(0, text.length),
                    ),
                )
            },
        )
    }
}

class CsvExtractor : LocalTextExtractor(ArtifactFormat.CSV)
class TextExtractor : LocalTextExtractor(ArtifactFormat.TEXT, ArtifactFormat.MARKDOWN, ArtifactFormat.PASTED_TEXT)
class ImageExtractor : LocalTextExtractor(ArtifactFormat.PNG, ArtifactFormat.JPEG) {
    override fun extractText(bytes: ByteArray): String = printableRuns(bytes)
}

fun defaultAndroidExtractors(): List<ArtifactExtractor> = listOf(
    PdfExtractor(), DocxExtractor(), XlsxExtractor(), CsvExtractor(), TextExtractor(), ImageExtractor(),
)

private fun printableRuns(bytes: ByteArray): String = bytes
    .decodeToString()
    .replace(Regex("[^\\x20-\\x7E\\n\\r\\t]+"), " ")
    .replace(Regex("\\s+"), " ")
    .trim()
