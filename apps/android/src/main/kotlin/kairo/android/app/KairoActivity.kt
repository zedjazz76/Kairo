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
import kairo.android.copilot.Copilot
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell
import kairo.platform.db.RoomKnowledgeRepository

class KairoActivity : FragmentActivity() {

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

        setContent {
            var copilot by remember {
                mutableStateOf<Copilot?>(null)
            }

            LaunchedEffect(repository) {
                copilot =
                    KairoCompositionRoot
                        .fromRepository(
                            repository = repository,
                        )
                        .copilot
            }

            KairoShell(
                connectivity =
                    ConnectivityCapability.Offline,
                authenticator = authenticator,
                copilot = copilot,
            )
        }
    }

    override fun onDestroy() {
        super.onDestroy()
    }
}
