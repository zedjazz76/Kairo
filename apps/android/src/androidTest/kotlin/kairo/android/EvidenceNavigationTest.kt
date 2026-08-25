package kairo.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performClick
import kairo.android.auth.AuthenticationState
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import kairo.domain.EntityId
import kairo.domain.EvidenceRef
import kairo.domain.EvidenceState
import kairo.domain.FactId
import kairo.domain.FactObject
import kairo.domain.FactVersion
import kairo.domain.KnowledgeScope
import java.time.Instant
import org.junit.Rule
import org.junit.Test

class EvidenceNavigationTest {

    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun fact_evidence_action_opens_matching_source() {
        val evidence = EvidenceRef(
            sourceId = "source-pacs-manual",
            anchor = "page 42",
        )
        val fact = FactVersion(
            id = FactId("fact-pacsprod"),
            subject = EntityId("pacsprod"),
            predicate = "environment-name",
            objectValue = FactObject.Literal("PACSPROD"),
            scope = KnowledgeScope.MANA_PRODUCTION,
            state = EvidenceState.OBSERVED,
            effectiveFrom = null,
            effectiveTo = null,
            recordedAt = Instant.parse("2026-08-23T12:00:00Z"),
            lastValidatedAt = null,
            evidence = setOf(evidence),
        )

        composeRule.setContent {
            KairoShell(
                connectivity = ConnectivityCapability.Offline,
                authenticationState = AuthenticationState.Unlocked,
                knowledgeFacts = listOf(fact),
                evidenceSources = listOf(evidence),
            )
        }

        composeRule.onNodeWithTag("guardian_nav_memory", useUnmergedTree = true).performClick()
        composeRule.onNodeWithText("PACSPROD").performScrollTo().assertIsDisplayed()
        composeRule.onNodeWithText("Open evidence").performClick()

        composeRule.onNodeWithText("Evidence sources").assertIsDisplayed()
        composeRule.onNodeWithText("source-pacs-manual").assertIsDisplayed()
        composeRule.onNodeWithText("page 42").assertIsDisplayed()
    }
}
