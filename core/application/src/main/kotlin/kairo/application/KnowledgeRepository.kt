package kairo.application

import java.time.Instant
import kairo.domain.CaptureSession
import kairo.domain.EntityId
import kairo.domain.FactLineageId
import kairo.domain.FactVersion
import kairo.domain.Source

data class AuditEvent(
    val id: String,
    val action: String,
    val targetType: String,
    val targetId: String,
    val occurredAt: Instant,
    val correlationId: String,
) {
    init {
        require(id.isNotBlank()) { "Audit event id must not be blank" }
        require(action.isNotBlank()) { "Audit action must not be blank" }
        require(targetType.isNotBlank()) { "Audit target type must not be blank" }
        require(targetId.isNotBlank()) { "Audit target id must not be blank" }
        require(correlationId.isNotBlank()) { "Audit correlation id must not be blank" }
    }
}

data class FactQuery(
    val subject: EntityId? = null,
    val predicate: String? = null,
    val at: Instant = Instant.now(),
) {
    init {
        require(predicate == null || predicate.isNotBlank()) { "Fact query predicate must not be blank" }
    }
}

interface KnowledgeRepository {
    suspend fun appendFactVersion(fact: FactVersion, audit: AuditEvent)

    suspend fun currentUnderstanding(query: FactQuery): List<FactVersion>

    suspend fun history(lineageId: FactLineageId): List<FactVersion>

    suspend fun saveSource(source: Source, audit: AuditEvent)

    suspend fun saveCaptureSession(session: CaptureSession, audit: AuditEvent)
}
