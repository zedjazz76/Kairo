package kairo.android.shell

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import kairo.android.auth.AuthenticationState
import kairo.android.offline.ConnectivityCapability

@Composable
fun KairoShell(
    connectivity: ConnectivityCapability,
    authenticationState: AuthenticationState =
        AuthenticationState.Unlocked,
) {
    if (authenticationState == AuthenticationState.Locked) {
        Column {
            Text("Unlock Kairo")
        }
        return
    }

    val offline =
        connectivity == ConnectivityCapability.Offline

    Column {
        if (offline) {
            Text("Offline mode")
        }

        Button(
            onClick = {},
            enabled = true,
        ) {
            Text("Systems")
        }

        Button(
            onClick = {},
            enabled = true,
        ) {
            Text("Workflows")
        }

        Button(
            onClick = {},
            enabled = !offline,
        ) {
            Text("Deep Analyze")
        }
    }
}
