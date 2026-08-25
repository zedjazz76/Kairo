package kairo.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import kairo.android.auth.AuthenticationState
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import kairo.domain.EntityId
import kairo.domain.EvidenceRef
import kairo.domain.EvidenceState
import kairo.domain.FactId
import kairo.domain.FactLineageId
import kairo.domain.FactObject
import kairo.domain.FactVersion
import kairo.domain.KnowledgeScope
import java.time.Instant
import org.junit.Rule
import org.junit.Test

class WorkflowsFactsTest {

    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun workflows_destination_renders_workflow_related_approved_fact() {
        val fact =
            FactVersion(
                id = FactId("fact-ultrasound-workflow"),
                lineageId = FactLineageId("lineage-ultrasound-workflow"),
                subject = EntityId("ultrasound-workflow"),
                predicate = "routes-through",
                objectValue = FactObject.Literal("Ultrasound routes through GE ViewPoint before reporting."),
                scope = KnowledgeScope.MANA_PRODUCTION,
                state = EvidenceState.OBSERVED,
                effectiveFrom = null,
                effectiveTo = null,
                recordedAt = Instant.parse("2026-08-23T00:00:00Z"),
                lastValidatedAt = null,
                evidence = setOf(EvidenceRef(sourceId = "source-ultrasound-workflow")),
            )

        composeRule.setContent {
            KairoShell(
                connectivity = ConnectivityCapability.Offline,
                authenticationState = AuthenticationState.Unlocked,
                knowledgeFacts = listOf(fact),
            )
        }

        composeRule.onNodeWithText("Trace Workflow").performClick()
        composeRule.onNodeWithText("Trace Workflow").assertIsDisplayed()
        composeRule.onNodeWithText("EVIDENCE TIMELINE").performScrollTo().assertIsDisplayed()
        composeRule.onNodeWithText("Ultrasound routes through GE ViewPoint before reporting.").performScrollTo().assertIsDisplayed()
    }
}
