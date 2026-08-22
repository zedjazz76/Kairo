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

private enum class KairoDestination {
    Home,
    Systems,
}

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

    var destination by remember {
        mutableStateOf(KairoDestination.Home)
    }

    val scope = rememberCoroutineScope()

    if (state == AuthenticationState.Locked) {
        Column {
            Button(
                onClick = {
                    val auth =
                        authenticator
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

    when (destination) {
        KairoDestination.Home ->
            HomeDestination(
                connectivity = connectivity,
                onSystems = {
                    destination =
                        KairoDestination.Systems
                },
            )

        KairoDestination.Systems ->
            SystemsDestination(
                onBack = {
                    destination =
                        KairoDestination.Home
                },
            )
    }
}

@Composable
private fun HomeDestination(
    connectivity: ConnectivityCapability,
    onSystems: () -> Unit,
) {
    val offline =
        connectivity == ConnectivityCapability.Offline

    Column {
        if (offline) {
            Text("Offline mode")
        }

        Button(
            onClick = onSystems,
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

@Composable
private fun SystemsDestination(
    onBack: () -> Unit,
) {
    Column {
        Button(
            onClick = onBack,
        ) {
            Text("Back")
        }

        Text("Systems overview")
    }
}
