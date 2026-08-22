package kairo.platform.search

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kairo.domain.AnchorLocator
import kairo.domain.EvidenceState
import kairo.domain.IncidentPattern
import kairo.domain.IncidentPatternId
import kairo.domain.KnowledgeScope
import kairo.domain.SourceAnchor
import kairo.domain.SourceId
import kairo.domain.SourceVariantId
import kairo.domain.WorkflowId
import kairo.retrieval.SemanticIndexMetadata
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class EmbeddingSemanticIndexDeviceTest {

    @Test
    fun semanticAdapterReturnsIncidentFromPersistedVectorIndex() {
        val context =
            ApplicationProvider.getApplicationContext<Context>()

        val metadata = SemanticIndexMetadata(
            model = "fixture-embed",
            modelVersion = "1",
            dimensions = 3,
            quantization = "FLOAT32",
            contentHash = "incident-fixture-v1",
        )

        val vectorIndex = EmbeddingIndex(
            context = context,
            metadata = metadata,
        )

        val routingIncident = incident(
            id = "routing-incident",
            symptom = "Breast studies are not arriving in MagView.",
        )

        val unrelatedIncident = incident(
            id = "unrelated-incident",
            symptom = "A workstation display preference changed.",
        )

        val embeddingProvider = TextEmbeddingProvider { text ->
            when {
                text.contains("interpretation", ignoreCase = true) ->
                    floatArrayOf(1.0f, 0.0f, 0.0f)

                text.contains("MagView", ignoreCase = true) ->
                    floatArrayOf(1.0f, 0.0f, 0.0f)

                else ->
                    floatArrayOf(0.0f, 1.0f, 0.0f)
            }
        }

        val semanticIndex = EmbeddingSemanticIndex<IncidentPattern>(
            embeddingIndex = vectorIndex,
            embeddingProvider = embeddingProvider,
            idOf = { incident: IncidentPattern ->
                incident.id.value
            },
            textOf = { incident: IncidentPattern ->
                incident.symptom
            },
        )

        vectorIndex.clear()

        semanticIndex.rebuild(
            listOf(
                routingIncident,
                unrelatedIncident,
            ),
        )

        val result = semanticIndex.search(
            query = "studies failing to reach interpretation",
            candidates = listOf(
                routingIncident,
                unrelatedIncident,
            ),
        )

        assertEquals(
            routingIncident.id,
            result.first().id,
        )
    }

    private fun incident(
        id: String,
        symptom: String,
    ): IncidentPattern =
        IncidentPattern(
            id = IncidentPatternId(id),
            symptom = symptom,
            affectedWorkflow = WorkflowId("breast-imaging"),
            rootCause = "Fixture root cause",
            resolution = "Fixture resolution",
            prevention = "Fixture prevention",
            scope = KnowledgeScope.INCIDENT,
            evidenceState = EvidenceState.OBSERVED,
            evidenceAnchors = setOf(
                SourceAnchor(
                    sourceId = SourceId("source-$id"),
                    variantId = SourceVariantId("variant-$id"),
                    locator = AnchorLocator.TextSpan(0, symptom.length),
                ),
            ),
        )
}
