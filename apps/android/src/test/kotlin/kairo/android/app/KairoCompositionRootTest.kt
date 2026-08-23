package kairo.android.app

import java.time.Instant
import kairo.domain.EntityId
import kairo.domain.EvidenceState
import kairo.domain.EvidenceRef
import kairo.domain.FactId
import kairo.domain.FactLineageId
import kairo.domain.FactObject
import kairo.domain.FactVersion
import kairo.domain.KnowledgeScope
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test

class KairoCompositionRootTest {

    @Test
    fun root_answers_from_loaded_authoritative_facts() =
        runBlocking {
            val facts =
                listOf(
                    FactVersion(
                        id = FactId("fact-dmwl-host"),
                        lineageId =
                            FactLineageId("lineage-dmwl-host"),
                        subject =
                            EntityId("modality-worklist"),
                        predicate = "hosted-by",
                        objectValue =
                            FactObject.Literal(
                                "Merge PACS hosts the modality worklist.",
                            ),
                        scope =
                            KnowledgeScope.MANA_PRODUCTION,
                        state =
                            EvidenceState.CONFIRMED,
                        effectiveFrom = null,
                        effectiveTo = null,
                        recordedAt =
                            Instant.parse(
                                "2026-08-22T00:00:00Z",
                            ),
                        lastValidatedAt = null,
                        evidence =
                            setOf(
                                EvidenceRef(
                                    sourceId = "source-dmwl-host",
                                    anchor = "test-fixture",
                                    extractionConfidence = 1.0,
                                ),
                            ),
                    ),
                )

            val root =
                KairoCompositionRoot.fromFacts(
                    facts = facts,
                )

            val answer =
                root.copilot.ask(
                    "Who hosts the modality worklist?",
                )

            assertEquals(
                "Merge PACS hosts the modality worklist.",
                answer.text,
            )
        }
}
