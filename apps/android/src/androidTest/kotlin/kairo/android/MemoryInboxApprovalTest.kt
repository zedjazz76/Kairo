package kairo.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertDoesNotExist
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import kairo.android.auth.AuthenticationState
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import kairo.application.InMemoryMemoryInboxStore
import kairo.application.MemoryInboxService
import kairo.domain.AnchorLocator
import kairo.domain.CaptureSessionId
import kairo.domain.SourceAnchor
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.ingestion.MemoryCandidateDraft
import org.junit.Rule
import org.junit.Test

class MemoryInboxApprovalTest {

    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun pending_candidate_can_be_approved_from_memory_inbox() {
        val store = InMemoryMemoryInboxStore()
        val memoryInbox = MemoryInboxService(
            repository = FakeKnowledgeRepository(),
            store = store,
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

        composeRule.waitForIdle()

        composeRule
            .onNodeWithText("Merge PACS hosts the modality worklist.")
            .assertDoesNotExist()
    }
}
