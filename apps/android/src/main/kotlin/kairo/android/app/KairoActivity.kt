package kairo.android.app

import android.os.Bundle
import android.os.SystemClock
import androidx.fragment.app.FragmentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import kairo.android.auth.AndroidAuthenticator
import kairo.android.auth.Authenticator
import kairo.android.capture.KnowledgeCapture
import kairo.android.capture.KnowledgeCaptureRequest
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import kairo.android.theme.KairoTheme
import kairo.application.MemoryInboxService
import kairo.domain.EvidenceRef
import kairo.domain.FactVersion
import kairo.platform.db.RoomKnowledgeRepository

class KairoActivity : FragmentActivity() {

    companion object {
        var authenticatorOverride: Authenticator? = null
        var relockTimeoutMillisOverride: Long? = null
        private const val DEFAULT_RELOCK_TIMEOUT_MILLIS = 5 * 60 * 1000L
    }

    private var backgroundedAtElapsedRealtime: Long? = null
    private var relockRequested by mutableStateOf(false)

    lateinit var memoryInbox: MemoryInboxService
        private set

    override fun onCreate(
        savedInstanceState: Bundle?,
    ) {
        super.onCreate(savedInstanceState)

        val authenticator =
            authenticatorOverride
                ?: AndroidAuthenticator(
                    activity = this,
                )

        val database =
            KairoDatabaseFactory.open(
                context = this,
            )

        val repository =
            RoomKnowledgeRepository(
                database = database,
            )

        val session =
            KairoKnowledgeSession(
                repository = repository,
            )

        memoryInbox = session.memoryInbox

        setContent {
            var loaded by remember {
                mutableStateOf(false)
            }

            var sessionRevision by remember {
                mutableStateOf(0)
            }

            var evidenceSources by remember {
                mutableStateOf<List<EvidenceRef>>(emptyList())
            }

            var knowledgeFacts by remember {
                mutableStateOf<List<FactVersion>>(emptyList())
            }

            LaunchedEffect(session) {
                session.load()
                evidenceSources = session.evidenceSources()
                knowledgeFacts = session.knowledgeFacts()
                loaded = true
                sessionRevision = session.revision
            }

            val observableCapture =
                remember(session) {
                    object : KnowledgeCapture {
                        override suspend fun save(
                            request: KnowledgeCaptureRequest,
                        ) {
                            session.knowledgeCapture.save(
                                request,
                            )

                            evidenceSources = session.evidenceSources()
                            knowledgeFacts = session.knowledgeFacts()
                            sessionRevision =
                                session.revision
                        }
                    }
                }

            KairoTheme {
                val activeCopilot =
                    if (loaded) {
                        sessionRevision
                        session.copilot
                    } else {
                        null
                    }

                KairoShell(
                    connectivity =
                        ConnectivityCapability.Offline,
                    authenticator = authenticator,
                    copilot = activeCopilot,
                    knowledgeCapture =
                        observableCapture,
                    memoryInbox = memoryInbox,
                    onApproveMemory =
                        { candidateId, reviewer ->
                            session.approveMemory(
                                candidateId = candidateId,
                                reviewer = reviewer,
                            )

                            evidenceSources = session.evidenceSources()
                            knowledgeFacts = session.knowledgeFacts()
                            sessionRevision =
                                session.revision
                        },
                    deepAnalyze = session::deepAnalyze,
                    evidenceSources = evidenceSources,
                    knowledgeFacts = knowledgeFacts,
                    shouldRelock = { relockRequested },
                )
            }
        }
    }

    override fun onStop() {
        backgroundedAtElapsedRealtime = SystemClock.elapsedRealtime()
        super.onStop()
    }

    override fun onResume() {
        super.onResume()

        val backgroundedAt = backgroundedAtElapsedRealtime ?: return
        val timeoutMillis = relockTimeoutMillisOverride ?: DEFAULT_RELOCK_TIMEOUT_MILLIS
        if (SystemClock.elapsedRealtime() - backgroundedAt >= timeoutMillis) {
            relockRequested = true
        }
        backgroundedAtElapsedRealtime = null
    }

    override fun onDestroy() {
        super.onDestroy()
    }
}
