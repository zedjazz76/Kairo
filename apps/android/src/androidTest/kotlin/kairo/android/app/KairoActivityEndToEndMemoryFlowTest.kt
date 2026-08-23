package kairo.android.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodes
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
    val composeRule = createAndroidComposeRule<TestFragmentActivity>()

    @Test
    fun capture_approve_and_ask_returns_approved_fact() = runBlocking {
        val context = composeRule.activity
        val database = KairoDatabaseFactory.open(context)
        database.clearAllTables()

        val repository = RoomKnowledgeRepository(database)
        val session = KairoKnowledgeSession(repository)
        session.load()

        var revision by mutableStateOf(session.revision)
        var copilot: Copilot by mutableStateOf(session.copilot)

        val capture = object : KnowledgeCapture {
            override suspend fun save(request: KnowledgeCaptureRequest) {
                session.knowledgeCapture.save(request)
                revision = session.revision
                copilot = session.copilot
            }
        }

        composeRule.setContent {
            revision
            KairoShell(
                connectivity = ConnectivityCapability.Online,
                authenticationState = AuthenticationState.Unlocked,
                copilot = copilot,
                knowledgeCapture = capture,
                memoryInbox = session.memoryInbox,
                onApproveMemory = { candidateId: MemoryCandidateId, reviewer: String ->
                    session.approveMemory(candidateId, reviewer)
                    revision = session.revision
                    copilot = session.copilot
                },
            )
        }

        composeRule.onNodeWithText("Capture").performClick()
        composeRule.onAllNodes(hasSetTextAction())[0].performTextInput("modality-worklist")
        composeRule.onAllNodes(hasSetTextAction())[1].performTextInput("hosted-by")
        composeRule.onAllNodes(hasSetTextAction())[2].performTextInput("Merge PACS hosts the modality worklist.")
        composeRule.onNodeWithText("Save").performClick()
        composeRule.onNodeWithText("Back").performClick()
        composeRule.onNodeWithText("Memory Inbox").performClick()

        composeRule.waitUntil(timeoutMillis = 5_000) {
            composeRule.onAllNodesWithText("Merge PACS hosts the modality worklist.").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("Approve").performClick()
        composeRule.onNodeWithText("Back").performClick()
        composeRule.onNodeWithText("Copilot").performClick()
        composeRule.onAllNodes(hasSetTextAction())[0].performTextInput("Who hosts the modality worklist?")
        composeRule.onNodeWithText("Send").performClick()

        composeRule.waitUntil(timeoutMillis = 5_000) {
            composeRule.onAllNodesWithText("Merge PACS hosts the modality worklist.").fetchSemanticsNodes().isNotEmpty()
        }

        database.close()
    }
}
