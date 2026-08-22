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
import kairo.android.navigation.KairoDestination
import kairo.android.navigation.KairoNavigator
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

    val navigator =
        remember {
            KairoNavigator()
        }

    var destination by remember {
        mutableStateOf(navigator.destination)
    }

    fun navigateTo(
        target: KairoDestination,
    ) {
        navigator.navigateTo(target)
        destination = navigator.destination
    }

    fun backHome() {
        navigator.backHome()
        destination = navigator.destination
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
                    navigateTo(
                        KairoDestination.Systems,
                    )
                },
                onWorkflows = {
                    navigateTo(
                        KairoDestination.Workflows,
                    )
                },
                onProjects = {
                    navigateTo(
                        KairoDestination.Projects,
                    )
                },
                onKnowledge = {
                    navigateTo(
                        KairoDestination.Knowledge,
                    )
                },
                onCapture = {
                    navigateTo(
                        KairoDestination.Capture,
                    )
                },
                onSources = {
                    navigateTo(
                        KairoDestination.Sources,
                    )
                },
                onMemoryInbox = {
                    navigateTo(
                        KairoDestination.MemoryInbox,
                    )
                },
            )

        KairoDestination.Systems ->
            SystemsDestination(
                onBack = {
                    backHome()
                },
            )

        KairoDestination.Workflows ->
            WorkflowsDestination(
                onBack = {
                    backHome()
                },
            )

        KairoDestination.Projects ->
            ProjectsDestination(
                onBack = {
                    backHome()
                },
            )

        KairoDestination.Knowledge ->
            KnowledgeDestination(
                onBack = {
                    backHome()
                },
            )

        KairoDestination.Capture ->
            CaptureDestination(
                onBack = {
                    backHome()
                },
            )

        KairoDestination.Sources ->
            SourcesDestination(
                onBack = {
                    backHome()
                },
            )

        KairoDestination.MemoryInbox ->
            MemoryInboxDestination(
                onBack = {
                    backHome()
                },
            )
    }
}

@Composable
private fun HomeDestination(
    connectivity: ConnectivityCapability,
    onSystems: () -> Unit,
    onWorkflows: () -> Unit,
    onProjects: () -> Unit,
    onKnowledge: () -> Unit,
    onCapture: () -> Unit,
    onSources: () -> Unit,
    onMemoryInbox: () -> Unit,
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
            onClick = onWorkflows,
        ) {
            Text("Workflows")
        }

        Button(
            onClick = onProjects,
        ) {
            Text("Projects")
        }

        Button(
            onClick = onKnowledge,
        ) {
            Text("Knowledge")
        }

        Button(
            onClick = onCapture,
        ) {
            Text("Capture")
        }

        Button(
            onClick = onSources,
        ) {
            Text("Sources")
        }

        Button(
            onClick = onMemoryInbox,
        ) {
            Text("Memory Inbox")
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
private fun MemoryInboxDestination(
    onBack: () -> Unit,
) {
    Column {
        Button(
            onClick = onBack,
        ) {
            Text("Back")
        }

        Text("Memory Inbox overview")
    }
}

@Composable
private fun SourcesDestination(
    onBack: () -> Unit,
) {
    Column {
        Button(
            onClick = onBack,
        ) {
            Text("Back")
        }

        Text("Sources overview")
    }
}

@Composable
private fun CaptureDestination(
    onBack: () -> Unit,
) {
    Column {
        Button(
            onClick = onBack,
        ) {
            Text("Back")
        }

        Text("Capture intake")
    }
}

@Composable
private fun KnowledgeDestination(
    onBack: () -> Unit,
) {
    Column {
        Button(
            onClick = onBack,
        ) {
            Text("Back")
        }

        Text("Knowledge overview")
    }
}

@Composable
private fun ProjectsDestination(
    onBack: () -> Unit,
) {
    Column {
        Button(
            onClick = onBack,
        ) {
            Text("Back")
        }

        Text("Projects overview")
    }
}

@Composable
private fun WorkflowsDestination(
    onBack: () -> Unit,
) {
    Column {
        Button(
            onClick = onBack,
        ) {
            Text("Back")
        }

        Text("Workflows overview")
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
