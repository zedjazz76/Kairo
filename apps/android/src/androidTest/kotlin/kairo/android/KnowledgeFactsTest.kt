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

class KnowledgeFactsTest {

    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun knowledge_destination_renders_approved_fact_and_state() {
        val fact =
            FactVersion(
                id = FactId("fact-dmwl-host"),
                lineageId = FactLineageId("lineage-dmwl-host"),
                subject = EntityId("modality-worklist"),
                predicate = "hosted-by",
                objectValue = FactObject.Literal("Merge PACS hosts the modality worklist."),
                scope = KnowledgeScope.MANA_PRODUCTION,
                state = EvidenceState.CONFIRMED,
                effectiveFrom = null,
                effectiveTo = null,
                recordedAt = Instant.parse("2026-08-23T00:00:00Z"),
                lastValidatedAt = null,
                evidence = setOf(EvidenceRef(sourceId = "source-dmwl")),
            )

        composeRule.setContent {
            KairoShell(
                connectivity = ConnectivityCapability.Offline,
                authenticationState = AuthenticationState.Unlocked,
                knowledgeFacts = listOf(fact),
            )
        }

        composeRule
            .onNodeWithText("Knowledge")
            .assertIsDisplayed()
            .performClick()

        composeRule
            .onNodeWithText("Merge PACS hosts the modality worklist.")
            .assertIsDisplayed()
        composeRule
            .onNodeWithText("CONFIRMED")
            .assertIsDisplayed()
    }
}
