package kairo.android.reasoning

import androidx.test.platform.app.InstrumentationRegistry
import kairo.android.BuildConfig
import kairo.application.ReasoningPacket
import kairo.retrieval.EvidenceBundle
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test

class LiveDeepAnalyzeDeviceGateTest {

    @Test
    fun production_android_adapter_reaches_local_relay_for_non_phi_request() =
        runBlocking {
            val arguments = InstrumentationRegistry.getArguments()
            assumeTrue(arguments.getString("kairo.live") == "true")
            assertTrue(BuildConfig.LOCAL_RELAY_URL.isNotBlank())

            val answer =
                LocalRelayReasoningProvider(BuildConfig.LOCAL_RELAY_URL)
                    .analyze(
                        ReasoningPacket(
                            question =
                                "For this non-PHI relay verification, provide a short advisory and make no MANA-specific claims.",
                            evidence = EvidenceBundle(rankedClaims = emptyList()),
                            confirmed = emptyList(),
                            observed = emptyList(),
                            planned = emptyList(),
                            hypotheses = emptyList(),
                            unknowns = emptyList(),
                            prohibitedActions =
                                listOf("Do not perform production clinical-system writes."),
                        ),
                    )

            assertTrue(answer.text.isNotBlank())
            assertFalse(
                answer.claims.any { claim ->
                    claim.action.name == "PRODUCTION_WRITE"
                },
            )
        }
}
