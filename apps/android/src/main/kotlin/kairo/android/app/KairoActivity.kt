package kairo.android.app

import android.os.Bundle
import androidx.fragment.app.FragmentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import kairo.android.auth.AndroidAuthenticator
import kairo.android.capture.KnowledgeCapture
import kairo.android.capture.KnowledgeCaptureRequest
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import kairo.android.theme.KairoTheme
import kairo.application.MemoryInboxService
import kairo.platform.db.RoomKnowledgeRepository

class KairoActivity : FragmentActivity() {

    lateinit var memoryInbox: MemoryInboxService
        private set

    override fun onCreate(
        savedInstanceState: Bundle?,
    ) {
        super.onCreate(savedInstanceState)

        val authenticator =
            AndroidAuthenticator(
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

            LaunchedEffect(session) {
                session.load()
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
                )
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
    }
}
