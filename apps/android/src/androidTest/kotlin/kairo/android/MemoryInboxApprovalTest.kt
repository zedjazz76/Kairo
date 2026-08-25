package kairo.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import kairo.android.auth.AuthenticationState
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import kairo.application.AuditEvent
import kairo.application.FactQuery
import kairo.application.InMemoryMemoryInboxStore
import kairo.application.KnowledgeRepository
import kairo.application.MemoryInboxService
import kairo.domain.AnchorLocator
import kairo.domain.CaptureSession
import kairo.domain.CaptureSessionId
import kairo.domain.FactLineageId
import kairo.domain.FactVersion
import kairo.domain.Source
import kairo.domain.SourceAnchor
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.ingestion.MemoryCandidateDraft
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.delay
import org.junit.Rule
import org.junit.Test

class MemoryInboxApprovalTest {

    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun pending_candidate_can_be_approved_from_memory_inbox() {
        val memoryInbox =
            MemoryInboxService(
                repository = FakeKnowledgeRepository(),
                store = InMemoryMemoryInboxStore(),
            )

        memoryInbox.receive(
            MemoryCandidateDraft(
                sessionId = CaptureSessionId("session-1"),
                subjectLabel = "modality-worklist",
                text = "Merge PACS hosts the modality worklist.",
                evidenceAnchors = setOf(
                    SourceAnchor(
                        sourceId = SourceId("source-1"),
                        variantId = SourceVariantId("variant-1"),
                        locator = AnchorLocator.TextSpan(0, 39),
                    ),
                ),
            ),
        )

        composeRule.setContent {
            KairoShell(
                connectivity = ConnectivityCapability.Offline,
                authenticationState = AuthenticationState.Unlocked,
                memoryInbox = memoryInbox,
            )
        }

        composeRule
            .onNodeWithText("Memory Inbox")
            .performClick()

        composeRule
            .onNodeWithText("Merge PACS hosts the modality worklist.")
            .assertIsDisplayed()

        composeRule
            .onNodeWithText("Approve")
            .performClick()

        composeRule.waitUntil(timeoutMillis = 5_000) {
            composeRule
                .onAllNodesWithText(
                    "Merge PACS hosts the modality worklist.",
                )
                .fetchSemanticsNodes()
                .isEmpty()
        }
    }

    @Test
    fun curated_genesis_candidates_can_be_explicitly_approved_from_memory_inbox() {
        var approved = false

        composeRule.setContent {
            KairoShell(
                connectivity = ConnectivityCapability.Offline,
                authenticationState = AuthenticationState.Unlocked,
                genesisSourceIds = setOf(SourceId("curated-mana-discovery")),
                onApproveGenesis = {
                    delay(1)
                    approved = true
                },
            )
        }

        composeRule
            .onNodeWithText("Memory Inbox")
            .performClick()

        composeRule
            .onNodeWithText("Approve curated Genesis knowledge")
            .assertIsDisplayed()
            .performClick()

        composeRule.waitUntil(timeoutMillis = 5_000) { approved }
    }

    private class FakeKnowledgeRepository : KnowledgeRepository {
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
}
