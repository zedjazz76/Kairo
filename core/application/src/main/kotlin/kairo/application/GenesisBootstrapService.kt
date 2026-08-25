package kairo.application

import java.time.Instant
import java.util.UUID
import kairo.domain.SourceId
import kairo.ingestion.GenesisImporter
import kairo.ingestion.GenesisManifest

data class GenesisBootstrapStageResult(
    val pendingCandidates: Int,
    val sourceIds: Set<SourceId>,
)

/**
 * Android composition uses this service to stage a curated local Genesis
 * package. It may save source provenance and create pending candidates, but it
 * deliberately delegates every active-fact decision to MemoryInboxService.
 */
class GenesisBootstrapService(
    private val importer: GenesisImporter,
    private val repository: KnowledgeRepository,
    private val memoryInbox: MemoryInboxService,
    private val sourceExists: suspend (SourceId) -> Boolean,
    private val now: () -> Instant = Instant::now,
) {
    suspend fun stage(manifest: GenesisManifest): GenesisBootstrapStageResult {
        val imported = importer.import(manifest)
        var pendingCandidates = 0
        val sourceIds = linkedSetOf<SourceId>()
        val currentFacts = repository.currentUnderstanding(FactQuery())

        imported.entries.forEach { entry ->
            val source = entry.source ?: return@forEach
            sourceIds += source.id
            if (!sourceExists(source.id)) {
                repository.saveSource(
                    source = source,
                    audit = AuditEvent(
                        id = "audit-genesis-${UUID.randomUUID()}",
                        action = "GENESIS_SOURCE_STAGED",
                        targetType = "SOURCE",
                        targetId = source.id.value,
                        occurredAt = now(),
                        correlationId = "genesis-${source.id.value}",
                    ),
                )
            }

            val existing = memoryInbox.pending().count { candidate ->
                candidate.draft.evidenceAnchors.any { anchor -> anchor.sourceId == source.id }
            } + currentFacts.count { fact ->
                fact.evidence.any { evidence -> evidence.sourceId == source.id.value }
            }
            entry.candidates.drop(existing).forEach { candidate ->
                memoryInbox.receive(candidate)
                pendingCandidates += 1
            }
        }

        return GenesisBootstrapStageResult(
            pendingCandidates = pendingCandidates,
            sourceIds = sourceIds,
        )
    }

    suspend fun approveStaged(
        sourceIds: Set<SourceId>,
        reviewer: String,
    ): Int {
        require(reviewer.isNotBlank()) { "Reviewer must not be blank" }
        val staged = memoryInbox.pending()
            .filter { candidate ->
                candidate.draft.evidenceAnchors.any { anchor -> anchor.sourceId in sourceIds }
            }
            .sortedBy { candidate -> candidate.id.value }

        staged.forEach { candidate ->
            memoryInbox.approve(candidate.id, reviewer)
        }
        return staged.size
    }
}
