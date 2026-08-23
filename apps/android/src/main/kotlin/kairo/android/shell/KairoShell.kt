package kairo.android.shell

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import kairo.android.auth.AuthenticationState
import kairo.android.auth.Authenticator
import kairo.android.copilot.Copilot
import kairo.android.capture.KnowledgeCapture
import kairo.android.capture.KnowledgeCaptureRequest
import kairo.android.navigation.KairoDestination
import kairo.android.navigation.KairoNavigator
import kairo.android.offline.ConnectivityCapability
import kairo.application.MemoryCandidateId
import kairo.application.MemoryInboxService
import kotlinx.coroutines.launch


@Composable
fun KairoShell(
    connectivity: ConnectivityCapability,
    authenticationState: AuthenticationState =
        AuthenticationState.Locked,
    authenticator: Authenticator? = null,
    copilot: Copilot? = null,
    knowledgeCapture: KnowledgeCapture? = null,
    memoryInbox: MemoryInboxService? = null,
    onApproveMemory: (suspend (MemoryCandidateId, String) -> Unit)? = null,
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
                onCopilot = {
                    navigateTo(
                        KairoDestination.Copilot,
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
                knowledgeCapture = knowledgeCapture,
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
                memoryInbox = memoryInbox,
                onApproveMemory = onApproveMemory,
                onBack = {
                    backHome()
                },
            )

        KairoDestination.Copilot ->
            CopilotDestination(
                copilot = copilot,
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
    onCopilot: () -> Unit,
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
            onClick = onCopilot,
        ) {
            Text("Copilot")
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
private fun CopilotDestination(
    copilot: Copilot?,
    onBack: () -> Unit,
) {
    var question by remember {
        mutableStateOf("")
    }

    var answer by remember {
        mutableStateOf<String?>(null)
    }

    val scope = rememberCoroutineScope()

    Column {
        Button(
            onClick = onBack,
        ) {
            Text("Back")
        }

        Text("Kairo Copilot")

        OutlinedTextField(
            value = question,
            onValueChange = {
                question = it
            },
            label = {
                Text("Ask Kairo")
            },
        )

        Button(
            onClick = {
                val activeCopilot =
                    copilot ?: return@Button

                val submittedQuestion =
                    question.trim()

                if (submittedQuestion.isEmpty()) {
                    return@Button
                }

                scope.launch {
                    answer =
                        activeCopilot.ask(
                            submittedQuestion,
                        )
                }
            },
            enabled = copilot != null,
        ) {
            Text("Send")
        }

        answer?.let {
            Text(it)
        }
    }
}

@Composable
private fun MemoryInboxDestination(
    memoryInbox: MemoryInboxService?,
    onApproveMemory: (suspend (MemoryCandidateId, String) -> Unit)?,
    onBack: () -> Unit,
) {
    var refreshToken by remember {
        mutableStateOf(0)
    }

    val scope = rememberCoroutineScope()

    Column {
        Button(
            onClick = onBack,
        ) {
            Text("Back")
        }

        Text("Memory Inbox overview")

        refreshToken

        memoryInbox
            ?.pending()
            ?.forEach { candidate ->
                Text(candidate.draft.text)

                Button(
                    onClick = {
                        scope.launch {
                            val approve = onApproveMemory
                            if (approve != null) {
                                approve(
                                    candidate.id,
                                    "LOCAL_OWNER",
                                )
                            } else {
                                memoryInbox.approve(
                                    candidateId = candidate.id,
                                    reviewer = "LOCAL_OWNER",
                                )
                            }

                            refreshToken += 1
                        }
                    },
                ) {
                    Text("Approve")
                }
            }
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
    knowledgeCapture: KnowledgeCapture?,
    onBack: () -> Unit,
) {
    var subject by remember {
        mutableStateOf("")
    }

    var predicate by remember {
        mutableStateOf("")
    }

    var value by remember {
        mutableStateOf("")
    }

    var saveStatus by remember {
        mutableStateOf<String?>(null)
    }

    val scope = rememberCoroutineScope()

    Column {
        Button(
            onClick = onBack,
        ) {
            Text("Back")
        }

        Text("Capture overview")

        OutlinedTextField(
            value = subject,
            onValueChange = {
                subject = it
            },
            label = {
                Text("Subject")
            },
        )

        OutlinedTextField(
            value = predicate,
            onValueChange = {
                predicate = it
            },
            label = {
                Text("Predicate")
            },
        )

        OutlinedTextField(
            value = value,
            onValueChange = {
                value = it
            },
            label = {
                Text("Fact")
            },
        )

        Button(
            onClick = {
                val capture =
                    knowledgeCapture ?: return@Button

                val request =
                    KnowledgeCaptureRequest(
                        subject = subject.trim(),
                        predicate = predicate.trim(),
                        value = value.trim(),
                    )

                if (
                    request.subject.isEmpty() ||
                    request.predicate.isEmpty() ||
                    request.value.isEmpty()
                ) {
                    return@Button
                }

                scope.launch {
                    saveStatus = "Saving..."

                    capture.save(request)

                    subject = ""
                    predicate = ""
                    value = ""
                    saveStatus = "Saved"
                }
            },
            enabled =
                knowledgeCapture != null &&
                    subject.isNotBlank() &&
                    predicate.isNotBlank() &&
                    value.isNotBlank(),
        ) {
            Text("Save")
        }

        saveStatus?.let {
            Text(it)
        }
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
