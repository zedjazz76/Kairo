package kairo.platform.ingestion

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.time.Instant
import java.util.UUID
import kairo.domain.AnchorLocator
import kairo.domain.CaptureSessionId
import kairo.domain.SourceAnchor
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.ingestion.ExtractedArtifact
import kairo.ingestion.IngestionArtifact
import kairo.ingestion.IngestionArtifactCheckpoint
import kairo.ingestion.IngestionCheckpoint
import kairo.ingestion.IngestionCheckpointStore
import kairo.ingestion.IngestionExtractionCheckpoint
import kairo.ingestion.IngestionPayloadReference
import kairo.ingestion.IngestionPayloadStore
import kairo.ingestion.IngestionStage
import kairo.ingestion.ArtifactFormat
import kairo.platform.db.IngestionCheckpointArtifactEntity
import kairo.platform.db.IngestionCheckpointEntity
import kairo.platform.db.KairoDatabase
import kairo.platform.vault.TemporarySessionStore
import kairo.security.UserSensitiveChoice

class RoomIngestionCheckpointStore(database: KairoDatabase) : IngestionCheckpointStore {
    private val dao = database.ingestionCheckpointDao()
    override fun load(sessionId: CaptureSessionId): IngestionCheckpoint? = dao.checkpoint(sessionId.value)?.let { row ->
        val artifacts = dao.artifacts(sessionId.value).map { it.toCheckpoint() }
        IngestionCheckpoint(sessionId, Instant.parse(row.capturedAt), artifacts, IngestionStage.valueOf(row.stage), artifacts.mapNotNull { artifact ->
            dao.artifacts(sessionId.value).first { it.variantId == artifact.variantId }.extractionRef?.let { IngestionExtractionCheckpoint(artifact, IngestionPayloadReference(it)) }
        }, row.sensitiveChoice?.let { UserSensitiveChoice.valueOf(it) })
    }
    override fun save(checkpoint: IngestionCheckpoint) {
        dao.save(IngestionCheckpointEntity(checkpoint.sessionId.value, checkpoint.capturedAt.toString(), checkpoint.stage.name, checkpoint.sensitiveChoice?.name))
        dao.deleteArtifacts(checkpoint.sessionId.value)
        dao.saveArtifacts(checkpoint.artifacts.map { artifact ->
            IngestionCheckpointArtifactEntity(checkpoint.sessionId.value, artifact.sourceId, artifact.variantId, artifact.fileName, artifact.mediaType, artifact.payload.value,
                checkpoint.extractions.firstOrNull { it.artifact.variantId == artifact.variantId }?.payload?.value)
        })
    }
    private fun IngestionCheckpointArtifactEntity.toCheckpoint() = IngestionArtifactCheckpoint(sourceId, variantId, fileName, mediaType, IngestionPayloadReference(payloadRef))
}

class TemporarySessionIngestionPayloadStore(private val temporary: TemporarySessionStore) : IngestionPayloadStore {
    override fun storeArtifact(sessionId: CaptureSessionId, artifact: IngestionArtifact) = put(sessionId, encodeArtifact(artifact))
    override fun loadArtifact(reference: IngestionPayloadReference): IngestionArtifact? = temporary.open(reference.value)?.let(::decodeArtifact)
    override fun storeExtraction(sessionId: CaptureSessionId, extracted: ExtractedArtifact) = put(sessionId, encodeExtraction(extracted))
    override fun loadExtraction(reference: IngestionPayloadReference): ExtractedArtifact? = temporary.open(reference.value)?.let(::decodeExtraction)
    override fun deleteTemporary(sessionId: CaptureSessionId) { temporary.sessionIds().filter { it.startsWith("${sessionId.value}:") }.forEach(temporary::delete) }
    private fun put(sessionId: CaptureSessionId, bytes: ByteArray): IngestionPayloadReference {
        val ref = IngestionPayloadReference("${sessionId.value}:${UUID.randomUUID()}"); temporary.put(ref.value, bytes); return ref
    }
}

private fun encodeArtifact(artifact: IngestionArtifact) = ByteArrayOutputStream().use { bytes -> DataOutputStream(bytes).use { out ->
    out.writeUTF(artifact.sourceId.value); out.writeUTF(artifact.variantId.value); out.writeUTF(artifact.fileName); out.writeBoolean(artifact.mediaType != null); artifact.mediaType?.let(out::writeUTF); out.writeInt(artifact.bytes.size); out.write(artifact.bytes)
}; bytes.toByteArray() }
private fun decodeArtifact(bytes: ByteArray) = DataInputStream(ByteArrayInputStream(bytes)).use { input ->
    val source = SourceId(input.readUTF()); val variant = SourceVariantId(input.readUTF()); val name = input.readUTF(); val media = if (input.readBoolean()) input.readUTF() else null; val body = ByteArray(input.readInt()).also(input::readFully); IngestionArtifact(source, variant, name, body, media)
}
private fun encodeExtraction(extracted: ExtractedArtifact) = ByteArrayOutputStream().use { bytes -> DataOutputStream(bytes).use { out ->
    val artifact = encodeArtifact(extracted.artifact); out.writeInt(artifact.size); out.write(artifact); out.writeUTF(extracted.format.name); out.writeUTF(extracted.text); out.writeInt(extracted.anchors.size); extracted.anchors.forEach { anchor -> out.writeUTF(anchor.sourceId.value); out.writeUTF(anchor.variantId.value); out.writeLocator(anchor.locator) }
}; bytes.toByteArray() }
private fun decodeExtraction(bytes: ByteArray) = DataInputStream(ByteArrayInputStream(bytes)).use { input ->
    val artifact = decodeArtifact(ByteArray(input.readInt()).also(input::readFully)); val format = ArtifactFormat.valueOf(input.readUTF()); val text = input.readUTF(); val anchors = buildSet { repeat(input.readInt()) { val source = SourceId(input.readUTF()); val variant = SourceVariantId(input.readUTF()); add(SourceAnchor(source, variant, input.readLocator())) } }; ExtractedArtifact(artifact, format, text, anchors)
}

private fun DataOutputStream.writeLocator(locator: AnchorLocator) = when (locator) {
    is AnchorLocator.TextSpan -> { writeByte(1); writeInt(locator.startOffset); writeInt(locator.endOffset) }
    is AnchorLocator.PdfPageBox -> { writeByte(2); writeInt(locator.page); writeDouble(locator.left); writeDouble(locator.top); writeDouble(locator.right); writeDouble(locator.bottom) }
    is AnchorLocator.ImageRegion -> { writeByte(3); writeInt(locator.left); writeInt(locator.top); writeInt(locator.width); writeInt(locator.height) }
    is AnchorLocator.SheetRange -> { writeByte(4); writeUTF(locator.sheet); writeInt(locator.firstRow); writeInt(locator.firstColumn); writeInt(locator.lastRow); writeInt(locator.lastColumn) }
    is AnchorLocator.ChatTurn -> { writeByte(5); writeUTF(locator.conversationId); writeInt(locator.turnNumber); writeBoolean(locator.startOffset != null); locator.startOffset?.let(::writeInt); locator.endOffset?.let(::writeInt) }
}

private fun DataInputStream.readLocator(): AnchorLocator = when (readByte().toInt()) {
    1 -> AnchorLocator.TextSpan(readInt(), readInt())
    2 -> AnchorLocator.PdfPageBox(readInt(), readDouble(), readDouble(), readDouble(), readDouble())
    3 -> AnchorLocator.ImageRegion(readInt(), readInt(), readInt(), readInt())
    4 -> AnchorLocator.SheetRange(readUTF(), readInt(), readInt(), readInt(), readInt())
    5 -> { val conversationId = readUTF(); val turn = readInt(); if (readBoolean()) AnchorLocator.ChatTurn(conversationId, turn, readInt(), readInt()) else AnchorLocator.ChatTurn(conversationId, turn) }
    else -> error("Unknown temporary extraction anchor type")
}
