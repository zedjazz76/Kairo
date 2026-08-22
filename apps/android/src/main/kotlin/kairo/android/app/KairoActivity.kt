package kairo.android.app

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.fragment.app.FragmentActivity
import kairo.android.auth.AndroidAuthenticator
import kairo.android.offline.ConnectivityCapability
import kairo.android.shell.KairoShell

class KairoActivity : FragmentActivity() {

    override fun onCreate(
        savedInstanceState: Bundle?,
    ) {
        super.onCreate(savedInstanceState)

        val authenticator =
            AndroidAuthenticator(
                activity = this,
            )

        val compositionRoot =
            KairoCompositionRoot.empty()

        setContent {
            KairoShell(
                connectivity =
                    ConnectivityCapability.Offline,
                authenticator = authenticator,
                copilot = compositionRoot.copilot,
            )
        }
    }
}
