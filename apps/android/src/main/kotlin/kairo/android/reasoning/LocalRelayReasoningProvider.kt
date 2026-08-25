package kairo.android.reasoning

import java.net.HttpURLConnection
import java.net.URL
import kairo.application.ReasoningPacket
import kairo.application.ReasoningProvider
import kairo.application.KairoAnswer
import kairo.domain.FactObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

class LocalRelayReasoningProvider(
    private val endpoint: String,
) : ReasoningProvider {

    override suspend fun analyze(packet: ReasoningPacket): KairoAnswer =
        withContext(Dispatchers.IO) {
            val connection =
                (URL(endpoint.trimEnd('/') + "/v1/deep-analyze").openConnection() as HttpURLConnection)
                    .apply {
                        requestMethod = "POST"
                        connectTimeout = 10_000
                        readTimeout = 45_000
                        doOutput = true
                        setRequestProperty("Content-Type", "application/json")
                    }

            try {
                connection.outputStream.bufferedWriter().use { writer ->
                    writer.write(requestBody(packet).toString())
                }

                if (connection.responseCode != HttpURLConnection.HTTP_OK) {
                    throw IllegalStateException("Local relay unavailable")
                }

                val payload =
                    connection.inputStream.bufferedReader().use {
                        it.readText()
                    }

                RelayAnswerMapper.map(parseResponse(payload))
            } finally {
                connection.disconnect()
            }
        }

    private fun requestBody(packet: ReasoningPacket): JSONObject =
        JSONObject()
            .put("question", packet.question)
            .put(
                "reasoningPacket",
                JSONObject()
                    .put("confirmed", packet.confirmed.toJsonArray())
                    .put("observed", packet.observed.toJsonArray())
                    .put("planned", packet.planned.toJsonArray())
                    .put("hypotheses", packet.hypotheses.toJsonArray())
                    .put("unknowns", JSONArray(packet.unknowns))
                    .put("prohibitedActions", JSONArray(packet.prohibitedActions)),
            )

    private fun List<kairo.retrieval.RankedFact>.toJsonArray(): JSONArray =
        JSONArray(map { ranked ->
            val fact = ranked.fact
            val objectText =
                when (val value = fact.objectValue) {
                    is FactObject.Entity -> value.value.value
                    is FactObject.Literal -> value.value
                }
            "${fact.state} [${fact.scope}] ${fact.subject.value} ${fact.predicate} $objectText " +
                "(evidence: ${fact.evidence.joinToString { it.sourceId }})"
        })

    private fun parseResponse(payload: String): RelayDeepAnalyzeResponse {
        val response = JSONObject(payload)
        val claims = response.optJSONArray("claims") ?: JSONArray()
        return RelayDeepAnalyzeResponse(
            text = response.getString("text"),
            claims =
                List(claims.length()) { index ->
                    val claim = claims.getJSONObject(index)
                    RelayClaim(
                        text = claim.getString("text"),
                        scope = claim.getString("scope"),
                        evidenceRefs =
                            claim.getJSONArray("evidenceRefs").let { refs ->
                                List(refs.length()) { refIndex -> refs.getString(refIndex) }
                            },
                        action = claim.getString("action"),
                    )
                },
        )
    }
}
