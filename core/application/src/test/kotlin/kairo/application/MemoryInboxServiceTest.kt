package kairo.application

import java.time.Instant
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicReference
import kotlin.coroutines.Continuation
import kotlin.coroutines.EmptyCoroutineContext
import kotlin.coroutines.startCoroutine
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kairo.domain.AnchorLocator
import kairo.domain.CaptureSession
import kairo.domain.CaptureSessionId
import kairo.domain.EntityId
import kairo.domain.EvidenceState
import kairo.domain.FactLineageId
import kairo.domain.FactObject
import kairo.domain.FactVersion
import kairo.domain.Source
import kairo.domain.SourceAnchor
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.ingestion.MemoryCandidateDraft

class MemoryInboxServiceTest {

    @Test
    fun `AI candidate cannot become active without human approval`() {
        runSuspend {
            val repository = RecordingKnowledgeRepository()
            val service = MemoryInboxService(repository)

            val candidate = MemoryCandidateDraft(
                sessionId = CaptureSessionId("session-1"),
                subjectLabel = "Merge PACS",
                text = "Merge PACS hosts DMWL.",
                evidenceAnchors = setOf(
                    SourceAnchor(
                        sourceId = SourceId("source-1"),
                        variantId = SourceVariantId("variant-1"),
                        locator = AnchorLocator.TextSpan(0, 21),
                    ),
                ),
            )

            service.receive(candidate)

            assertTrue(
                repository.currentUnderstanding(
                    FactQuery(
                        subject = EntityId("merge-pacs"),
                        predicate = "hosts",
                    ),
                ).isEmpty(),
            )

            val pending = service.pending().single()

            service.approve(
                candidateId = pending.id,
                reviewer = "LOCAL_OWNER",
            )

            val fact = repository.currentUnderstanding(
                FactQuery(
                    subject = EntityId("merge-pacs"),
                    predicate = "hosts",
                ),
            ).single()

            assertEquals(EvidenceState.OBSERVED, fact.state)
        }
    }

    @Test
    fun `reject records decision without creating active fact`() {
        runSuspend {
            val repository = RecordingKnowledgeRepository()
            val service = MemoryInboxService(repository)

            val pending = service.receive(
                MemoryCandidateDraft(
                    sessionId = CaptureSessionId("session-reject"),
                    subjectLabel = "Merge PACS",
                    text = "Merge PACS hosts DMWL.",
                    evidenceAnchors = setOf(
                        SourceAnchor(
                            sourceId = SourceId("source-reject"),
                            variantId = SourceVariantId("variant-reject"),
                            locator = AnchorLocator.TextSpan(0, 21),
                        ),
                    ),
                ),
            )

            service.reject(
                candidateId = pending.id,
                reviewer = "LOCAL_OWNER",
            )

            assertTrue(
                repository.currentUnderstanding(
                    FactQuery(subject = EntityId("merge-pacs")),
                ).isEmpty(),
            )

            val decision = service.decisions().single()

            assertEquals(pending.id, decision.candidateId)
            assertEquals(MemoryDecisionType.REJECTED, decision.type)
            assertEquals("LOCAL_OWNER", decision.reviewer)
            assertTrue(service.pending().isEmpty())
        }
    }

    @Test
    fun `defer records decision and keeps candidate pending without creating fact`() {
        runSuspend {
            val repository = RecordingKnowledgeRepository()
            val service = MemoryInboxService(repository)

            val pending = service.receive(
                MemoryCandidateDraft(
                    sessionId = CaptureSessionId("session-defer"),
                    subjectLabel = "AbbaDox",
                    text = "AbbaDox workflow requires verification.",
                    evidenceAnchors = setOf(
                        SourceAnchor(
                            sourceId = SourceId("source-defer"),
                            variantId = SourceVariantId("variant-defer"),
                            locator = AnchorLocator.TextSpan(0, 38),
                        ),
                    ),
                ),
            )

            service.defer(
                candidateId = pending.id,
                reviewer = "LOCAL_OWNER",
            )

            assertTrue(
                repository.currentUnderstanding(
                    FactQuery(subject = EntityId("abbadox")),
                ).isEmpty(),
            )

            val decision = service.decisions().single()

            assertEquals(pending.id, decision.candidateId)
            assertEquals(MemoryDecisionType.DEFERRED, decision.type)
            assertEquals("LOCAL_OWNER", decision.reviewer)

            assertEquals(
                pending.id,
                service.pending().single().id,
            )
        }
    }

    @Test
    fun `edit and approve preserves original candidate and promotes edited text`() {
        runSuspend {
            val repository = RecordingKnowledgeRepository()
            val service = MemoryInboxService(repository)

            val pending = service.receive(
                MemoryCandidateDraft(
                    sessionId = CaptureSessionId("session-edit"),
                    subjectLabel = "Merge PACS",
                    text = "Merge PACS hosts modality worklist.",
                    evidenceAnchors = setOf(
                        SourceAnchor(
                            sourceId = SourceId("source-edit"),
                            variantId = SourceVariantId("variant-edit"),
                            locator = AnchorLocator.TextSpan(0, 34),
                        ),
                    ),
                ),
            )

            service.editAndApprove(
                candidateId = pending.id,
                reviewer = "LOCAL_OWNER",
                editedText = "Merge PACS hosts DMWL.",
            )

            val fact = repository.currentUnderstanding(
                FactQuery(
                    subject = EntityId("merge-pacs"),
                    predicate = "hosts",
                ),
            ).single()

            assertEquals(
                FactObject.Literal("Merge PACS hosts DMWL."),
                fact.objectValue,
            )

            val decision = service.decisions().single()

            assertEquals(
                MemoryDecisionType.EDITED_AND_APPROVED,
                decision.type,
            )

            assertEquals(
                "Merge PACS hosts modality worklist.",
                decision.originalText,
            )

            assertEquals(
                "Merge PACS hosts DMWL.",
                decision.approvedText,
            )

            assertTrue(service.pending().isEmpty())
        }
    }

    private class RecordingKnowledgeRepository : KnowledgeRepository {
        private val facts = mutableListOf<FactVersion>()

        override suspend fun appendFactVersion(
            fact: FactVersion,
            audit: AuditEvent,
        ) {
            facts += fact
        }

        override suspend fun currentUnderstanding(
            query: FactQuery,
        ): List<FactVersion> =
            facts.filter { fact ->
                (query.subject == null || fact.subject == query.subject) &&
                    (query.predicate == null || fact.predicate == query.predicate)
            }

        override suspend fun history(
            lineageId: FactLineageId,
        ): List<FactVersion> =
            facts.filter { it.lineageId == lineageId }

        override suspend fun saveSource(
            source: Source,
            audit: AuditEvent,
        ) = Unit

        override suspend fun saveCaptureSession(
            session: CaptureSession,
            audit: AuditEvent,
        ) = Unit
    }

    private fun <T> runSuspend(block: suspend () -> T): T {
        val latch = CountDownLatch(1)
        val result = AtomicReference<Result<T>>()

        block.startCoroutine(
            object : Continuation<T> {
                override val context = EmptyCoroutineContext

                override fun resumeWith(resultValue: Result<T>) {
                    result.set(resultValue)
                    latch.countDown()
                }
            },
        )

        latch.await()
        return result.get().getOrThrow()
    }
}
