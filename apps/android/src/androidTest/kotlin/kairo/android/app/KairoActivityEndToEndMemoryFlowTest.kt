package kairo.android.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import kairo.android.auth.AuthenticationState
import kairo.android.capture.KnowledgeCapture
import kairo.android.capture.KnowledgeCaptureRequest
import kairo.android.copilot.Copilot
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import kairo.android.test.TestFragmentActivity
import kairo.application.MemoryCandidateId
import kairo.platform.db.RoomKnowledgeRepository
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test

class KairoActivityEndToEndMemoryFlowTest {

    @get:Rule
    val composeRule =
        createAndroidComposeRule<TestFragmentActivity>()

    @Test
    fun capture_approve_and_ask_returns_approved_fact() {
        val database =
            KairoDatabaseFactory.open(
                context = composeRule.activity,
            )

        database.clearAllTables()

        val repository =
            RoomKnowledgeRepository(
                database = database,
            )

        val session =
            KairoKnowledgeSession(
                repository = repository,
            )

        runBlocking {
            session.load()
        }

        var copilot by mutableStateOf<Copilot>(session.copilot)

        val capture =
            object : KnowledgeCapture {
                override suspend fun save(
                    request: KnowledgeCaptureRequest,
                ) {
                    session.knowledgeCapture.save(request)
                    copilot = session.copilot
                }
            }

        fun approve(
            candidateId: MemoryCandidateId,
            reviewer: String,
        ) {
            runBlocking {
                session.approveMemory(
                    candidateId = candidateId,
                    reviewer = reviewer,
                )
                copilot = session.copilot
            }
        }

        composeRule.setContent {
            KairoShell(
                connectivity = ConnectivityCapability.Offline,
                authenticationState = AuthenticationState.Unlocked,
                copilot = copilot,
                knowledgeCapture = capture,
                memoryInbox = session.memoryInbox,
                onApproveMemory = ::approve,
            )
        }

        composeRule
            .onNodeWithText("Capture")
            .performClick()

        composeRule
            .onNodeWithText("Subject")
            .performTextInput("modality-worklist")

        composeRule
            .onNodeWithText("Predicate")
            .performTextInput("hosted-by")

        composeRule
            .onNodeWithText("Fact")
            .performTextInput(
                "Merge PACS hosts the modality worklist.",
            )

        composeRule
            .onNodeWithText("Save")
            .performClick()

        composeRule
            .onNodeWithText("Back")
            .performClick()

        composeRule
            .onNodeWithText("Memory Inbox")
            .performClick()

        composeRule
            .onNodeWithText(
                "Merge PACS hosts the modality worklist.",
            )
            .assertExists()

        composeRule
            .onNodeWithText("Approve")
            .performClick()

        composeRule
            .onNodeWithText("Back")
            .performClick()

        composeRule
            .onNodeWithText("Copilot")
            .performClick()

        composeRule
            .onNodeWithText("Ask Kairo")
            .performTextInput(
                "Who hosts the modality worklist?",
            )

        composeRule
            .onNodeWithText("Send")
            .performClick()

        composeRule.waitUntil(timeoutMillis = 5_000) {
            composeRule
                .onAllNodesWithText(
                    "Merge PACS hosts the modality worklist.",
                )
                .fetchSemanticsNodes()
                .isNotEmpty()
        }

        database.close()
    }
}
