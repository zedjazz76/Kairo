package kairo.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
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

class ProjectsFactsTest {

    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun projects_destination_renders_project_related_approved_fact() {
        val fact =
            FactVersion(
                id = FactId("fact-baxter-project"),
                lineageId = FactLineageId("lineage-baxter-project"),
                subject = EntityId("baxter-project"),
                predicate = "go-live",
                objectValue = FactObject.Literal("Baxter imaging go-live is planned for September 2."),
                scope = KnowledgeScope.MANA_PRODUCTION,
                state = EvidenceState.PLANNED,
                effectiveFrom = null,
                effectiveTo = null,
                recordedAt = Instant.parse("2026-08-23T00:00:00Z"),
                lastValidatedAt = null,
                evidence = setOf(EvidenceRef(sourceId = "source-baxter-project")),
            )

        composeRule.setContent {
            KairoShell(
                connectivity = ConnectivityCapability.Offline,
                authenticationState = AuthenticationState.Unlocked,
                knowledgeFacts = listOf(fact),
            )
        }

        composeRule.onNodeWithText("Projects").performClick()
        composeRule.onNodeWithText("Baxter imaging go-live is planned for September 2.").assertIsDisplayed()
        composeRule.onNodeWithText("PLANNED").assertIsDisplayed()
    }
}
