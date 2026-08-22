package kairo.android.shell

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import kairo.android.auth.AuthenticationState
import kairo.android.auth.Authenticator
import kairo.android.offline.ConnectivityCapability
import kotlinx.coroutines.launch

@Composable
fun KairoShell(
    connectivity: ConnectivityCapability,
    authenticationState: AuthenticationState =
        AuthenticationState.Locked,
    authenticator: Authenticator? = null,
) {
    var state by remember(authenticationState) {
        mutableStateOf(authenticationState)
    }

    val scope = rememberCoroutineScope()

    if (state == AuthenticationState.Locked) {
        Column {
            Button(
                onClick = {
                    val auth = authenticator
                        ?: return@Button

                    scope.launch {
                        if (auth.authenticate()) {
                            state =
                                AuthenticationState.Unlocked
                        }
                    }
                },
                enabled = authenticator != null,
            ) {
                Text("Unlock Kairo")
            }
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
        ) {
            Text("Systems")
        }

        Button(
            onClick = {},
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
