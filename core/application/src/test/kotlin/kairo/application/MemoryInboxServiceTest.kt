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
import kairo.domain.FactLineageId
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

            assertEquals(
                1,
                repository.currentUnderstanding(
                    FactQuery(
                        subject = EntityId("merge-pacs"),
                        predicate = "hosts",
                    ),
                ).size,
            )
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

                override fun resumeWith(value: Result<T>) {
                    result.set(value)
                    latch.countDown()
                }
            },
        )

        latch.await()
        return result.get().getOrThrow()
    }
}
