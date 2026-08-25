package kairo.android.app

import android.content.res.AssetManager
import kairo.application.GenesisBootstrapService
import kairo.application.GenesisBootstrapStageResult
import kairo.application.MemoryInboxService
import kairo.domain.SourceId
import kairo.ingestion.CuratedGenesisCandidateFactory
import kairo.ingestion.CuratedGenesisSeedExtractor
import kairo.ingestion.GenesisCandidateReceiver
import kairo.ingestion.GenesisCorpusStatus
import kairo.ingestion.GenesisImporter
import kairo.ingestion.GenesisManifest
import kairo.ingestion.GenesisManifestLoader
import kairo.ingestion.GenesisPayloadResolver
import kairo.ingestion.GenesisSourcePayload
import kairo.ingestion.GenesisSourceRecorder
import kairo.ingestion.IngestionPipeline
import kairo.platform.db.RoomKnowledgeRepository
import kairo.platform.security.LocalSensitiveContentScanner

/** Debug APK composition for the ignored local curated Genesis package. */
class AndroidGenesisBootstrapper(
    private val assets: AssetManager,
    private val repository: RoomKnowledgeRepository,
    private val memoryInbox: MemoryInboxService,
) {
    suspend fun stage(): GenesisBootstrapStageResult? {
        val manifest = loadManifest() ?: return null
        if (manifest.corpusStatus != GenesisCorpusStatus.READY) return null
        return coordinator().stage(manifest)
    }

    suspend fun approveStaged(
        sourceIds: Set<SourceId>,
        reviewer: String,
    ): Int = coordinator().approveStaged(sourceIds, reviewer)

    private fun coordinator(): GenesisBootstrapService {
        val scanner = LocalSensitiveContentScanner()
        val importer = GenesisImporter(
            pipeline = IngestionPipeline(
                extractors = listOf(CuratedGenesisSeedExtractor()),
                scanner = scanner::scan,
            ),
            payloadResolver = GenesisPayloadResolver { entry ->
                assetBytes(entry.sourceReference.removePrefix("private://"))?.let { bytes ->
                    GenesisSourcePayload(
                        fileName = entry.sourceReference.substringAfterLast('/'),
                        bytes = bytes,
                        mediaType = "text/plain",
                    )
                }
            },
            // The coordinator persists the returned source and candidates so it
            // can keep source existence and pending-candidate state idempotent.
            sourceRecorder = GenesisSourceRecorder { Unit },
            candidateReceiver = GenesisCandidateReceiver { Unit },
            candidateFactory = CuratedGenesisCandidateFactory(),
        )
        return GenesisBootstrapService(
            importer = importer,
            repository = repository,
            memoryInbox = memoryInbox,
            sourceExists = { sourceId -> repository.source(sourceId) != null },
        )
    }

    private fun loadManifest(): GenesisManifest? =
        assetBytes(MANIFEST_ASSET)
            ?.decodeToString()
            ?.let(GenesisManifestLoader()::load)

    private fun assetBytes(path: String): ByteArray? = try {
        assets.open(path).use { input -> input.readBytes() }
    } catch (_: java.io.FileNotFoundException) {
        null
    }

    private companion object {
        const val MANIFEST_ASSET = "genesis/manifest.json"
    }
}
