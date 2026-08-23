package kairo.android.shell

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kairo.android.auth.AuthenticationState
import kairo.android.auth.Authenticator
import kairo.android.capture.KnowledgeCapture
import kairo.android.capture.KnowledgeCaptureRequest
import kairo.android.copilot.Copilot
import kairo.android.navigation.KairoDestination
import kairo.android.navigation.KairoNavigator
import kairo.android.offline.ConnectivityCapability
import kairo.application.KairoAnswer
import kairo.application.MemoryCandidateId
import kairo.application.MemoryInboxService
import kairo.domain.EvidenceRef
import kairo.domain.FactObject
import kairo.domain.FactVersion
import kairo.security.UserSensitiveChoice
import kotlinx.coroutines.launch

@Composable
fun KairoShell(
    connectivity: ConnectivityCapability,
    authenticationState: AuthenticationState = AuthenticationState.Locked,
    authenticator: Authenticator? = null,
    copilot: Copilot? = null,
    knowledgeCapture: KnowledgeCapture? = null,
    memoryInbox: MemoryInboxService? = null,
    onApproveMemory: (suspend (MemoryCandidateId, String) -> Unit)? = null,
    deepAnalyze: (suspend (String) -> String)? = null,
    evidenceSources: List<EvidenceRef> = emptyList(),
    knowledgeFacts: List<FactVersion> = emptyList(),
    shouldRelock: (() -> Boolean)? = null,
    captureContainsLikelyPhi: Boolean = false,
    onSensitiveContentChoice: ((UserSensitiveChoice) -> Unit)? = null,
) {
    var state by remember(authenticationState) { mutableStateOf(authenticationState) }
    val navigator = remember { KairoNavigator() }
    var destination by remember { mutableStateOf(navigator.destination) }
    var selectedEvidenceSourceId by remember { mutableStateOf<String?>(null) }

    val relockRequested = shouldRelock?.invoke() == true
    if (state == AuthenticationState.Unlocked && relockRequested) {
        state = AuthenticationState.Locked
    }

    fun navigateTo(target: KairoDestination) {
        navigator.navigateTo(target)
        destination = navigator.destination
    }

    fun backHome() {
        navigator.backHome()
        destination = navigator.destination
        selectedEvidenceSourceId = null
    }

    fun openEvidence(sourceId: String) {
        selectedEvidenceSourceId = sourceId
        navigateTo(KairoDestination.Sources)
    }

    val scope = rememberCoroutineScope()

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        if (state == AuthenticationState.Locked) {
            LockedDestination(
                authenticator = authenticator,
                onUnlocked = { state = AuthenticationState.Unlocked },
                scope = scope,
            )
            return@Surface
        }

        when (destination) {
            KairoDestination.Home ->
                HomeDestination(
                    connectivity = connectivity,
                    onSystems = { navigateTo(KairoDestination.Systems) },
                    onWorkflows = { navigateTo(KairoDestination.Workflows) },
                    onProjects = { navigateTo(KairoDestination.Projects) },
                    onKnowledge = { navigateTo(KairoDestination.Knowledge) },
                    onCapture = { navigateTo(KairoDestination.Capture) },
                    onSources = { selectedEvidenceSourceId = null; navigateTo(KairoDestination.Sources) },
                    onMemoryInbox = { navigateTo(KairoDestination.MemoryInbox) },
                    onCopilot = { navigateTo(KairoDestination.Copilot) },
                    onDeepAnalyze = { navigateTo(KairoDestination.DeepAnalyze) },
                )

            KairoDestination.Systems ->
                SystemsDestination(
                    knowledgeFacts = knowledgeFacts,
                    onOpenEvidence = ::openEvidence,
                    onBack = ::backHome,
                )
            KairoDestination.Workflows ->
                WorkflowsDestination(
                    knowledgeFacts = knowledgeFacts,
                    onOpenEvidence = ::openEvidence,
                    onBack = ::backHome,
                )
            KairoDestination.Projects ->
                ProjectsDestination(
                    knowledgeFacts = knowledgeFacts,
                    onOpenEvidence = ::openEvidence,
                    onBack = ::backHome,
                )
            KairoDestination.Knowledge ->
                KnowledgeDestination(
                    knowledgeFacts = knowledgeFacts,
                    onOpenEvidence = ::openEvidence,
                    onBack = ::backHome,
                )
            KairoDestination.Capture ->
                CaptureDestination(
                    knowledgeCapture = knowledgeCapture,
                    containsLikelyPhi = captureContainsLikelyPhi,
                    onSensitiveContentChoice = onSensitiveContentChoice,
                    onBack = ::backHome,
                )
            KairoDestination.Sources ->
                SourcesDestination(
                    evidenceSources = evidenceSources,
                    selectedSourceId = selectedEvidenceSourceId,
                    onBack = ::backHome,
                )
            KairoDestination.MemoryInbox ->
                MemoryInboxDestination(
                    memoryInbox = memoryInbox,
                    onApproveMemory = onApproveMemory,
                    onBack = ::backHome,
                )
            KairoDestination.Copilot ->
                CopilotDestination(
                    copilot = copilot,
                    onBack = ::backHome,
                )
            KairoDestination.DeepAnalyze ->
                DeepAnalyzeDestination(
                    deepAnalyze = deepAnalyze,
                    onBack = ::backHome,
                )
        }
    }
}

@Composable
private fun LockedDestination(
    authenticator: Authenticator?,
    onUnlocked: () -> Unit,
    scope: kotlinx.coroutines.CoroutineScope,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(28.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = "KAIRO",
            style = MaterialTheme.typography.displaySmall,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Clinical Systems Copilot",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(28.dp))
        Button(
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                val auth = authenticator ?: return@Button
                scope.launch {
                    if (auth.authenticate()) onUnlocked()
                }
            },
            enabled = authenticator != null,
        ) {
            Text("Unlock Kairo")
        }
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
    onDeepAnalyze: () -> Unit,
) {
    val offline = connectivity == ConnectivityCapability.Offline

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text("KAIRO", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        Text(
            "Clinical Systems Copilot",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        if (offline) {
            StatusCard(
                title = "Offline mode",
                body = "Local knowledge remains available. Deep reasoning is unavailable.",
            )
        }

        FeatureCard(
            title = "Copilot",
            body = "Ask Kairo about approved local clinical-systems knowledge.",
            action = "Ask Kairo",
            onClick = onCopilot,
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            CompactAction(Modifier.weight(1f), "Capture", onCapture)
            CompactAction(Modifier.weight(1f), "Memory Inbox", onMemoryInbox)
        }

        Text(
            "Knowledge workspace",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            CompactAction(Modifier.weight(1f), "Systems", onSystems)
            CompactAction(Modifier.weight(1f), "Workflows", onWorkflows)
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            CompactAction(Modifier.weight(1f), "Projects", onProjects)
            CompactAction(Modifier.weight(1f), "Knowledge", onKnowledge)
        }
        CompactAction(Modifier.fillMaxWidth(), "Sources", onSources)

        OutlinedButton(
            modifier = Modifier.fillMaxWidth(),
            onClick = onDeepAnalyze,
            enabled = !offline,
        ) {
            Text("Deep Analyze")
        }
    }
}

@Composable
private fun FeatureCard(
    title: String,
    body: String,
    action: String,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
            Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Button(onClick = onClick) { Text(action) }
        }
    }
}

@Composable
private fun CompactAction(
    modifier: Modifier = Modifier,
    title: String,
    onClick: () -> Unit,
) {
    OutlinedButton(
        modifier = modifier,
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 14.dp),
        onClick = onClick,
    ) {
        Text(title)
    }
}

@Composable
private fun StatusCard(title: String, body: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(title, fontWeight = FontWeight.SemiBold)
            Text(
                body,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
private fun ScreenScaffold(
    title: String,
    subtitle: String? = null,
    onBack: () -> Unit,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        TextButton(onClick = onBack) { Text("Back") }
        Text(title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold)
        subtitle?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        content()
    }
}

@Composable
private fun CopilotDestination(
    copilot: Copilot?,
    onBack: () -> Unit,
) {
    var question by remember { mutableStateOf("") }
    var answer by remember { mutableStateOf<KairoAnswer?>(null) }
    val scope = rememberCoroutineScope()

    ScreenScaffold(
        title = "Kairo Copilot",
        subtitle = "Ask against approved local knowledge.",
        onBack = onBack,
    ) {
        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = question,
            onValueChange = { question = it },
            label = { Text("Ask Kairo") },
            minLines = 3,
        )
        Button(
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                val activeCopilot = copilot ?: return@Button
                val submittedQuestion = question.trim()
                if (submittedQuestion.isEmpty()) return@Button
                scope.launch { answer = activeCopilot.ask(submittedQuestion) }
            },
            enabled = copilot != null,
        ) {
            Text("Send")
        }
        answer?.let { renderedAnswer ->
            StructuredAnswerCard(renderedAnswer)
        }
    }
}

@Composable
private fun StructuredAnswerCard(answer: KairoAnswer) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(answer.text, style = MaterialTheme.typography.bodyLarge)
            answer.assessment?.let { AnswerSection("Assessment", it) }
            answer.currentManaUnderstanding?.let { AnswerSection("Current MANA Understanding", it) }
            answer.nextAction?.let { AnswerSection("Next action", it) }
            AnswerSection("Confidence", answer.confidence.name)
        }
    }
}

@Composable
private fun AnswerSection(title: String, body: String) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title, fontWeight = FontWeight.SemiBold)
        Text(body)
    }
}

@Composable
private fun DeepAnalyzeDestination(
    deepAnalyze: (suspend (String) -> String)?,
    onBack: () -> Unit,
) {
    var question by remember { mutableStateOf("") }
    var result by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    ScreenScaffold(
        title = "Deep Analyze overview",
        subtitle = "Run expanded diagnostic reasoning against the current Kairo evidence model.",
        onBack = onBack,
    ) {
        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = question,
            onValueChange = { question = it },
            label = { Text("Analyze question") },
            minLines = 3,
        )
        Button(
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                val analyze = deepAnalyze ?: return@Button
                val submitted = question.trim()
                if (submitted.isEmpty()) return@Button
                scope.launch {
                    result = analyze(submitted)
                }
            },
            enabled = deepAnalyze != null && question.isNotBlank(),
        ) {
            Text("Analyze")
        }
        result?.lineSequence()?.filter { it.isNotBlank() }?.forEach { line ->
            Text(line)
        }
    }
}

@Composable
private fun SystemsDestination(
    knowledgeFacts: List<FactVersion>,
    onOpenEvidence: (String) -> Unit,
    onBack: () -> Unit,
) {
    FactsDestination(
        title = "Systems overview",
        subtitle = "Inspect approved system facts from Kairo's current knowledge model.",
        emptyTitle = "No approved system facts",
        emptyBody = "Approved system knowledge will appear here after Memory Inbox review.",
        facts = knowledgeFacts,
        onOpenEvidence = onOpenEvidence,
        onBack = onBack,
    )
}

@Composable
private fun WorkflowsDestination(
    knowledgeFacts: List<FactVersion>,
    onOpenEvidence: (String) -> Unit,
    onBack: () -> Unit,
) {
    FactsDestination(
        title = "Workflows overview",
        subtitle = "Inspect approved workflow facts from Kairo's current knowledge model.",
        emptyTitle = "No approved workflow facts",
        emptyBody = "Approved workflow knowledge will appear here after Memory Inbox review.",
        facts = knowledgeFacts,
        onOpenEvidence = onOpenEvidence,
        onBack = onBack,
    )
}

@Composable
private fun ProjectsDestination(
    knowledgeFacts: List<FactVersion>,
    onOpenEvidence: (String) -> Unit,
    onBack: () -> Unit,
) {
    FactsDestination(
        title = "Projects overview",
        subtitle = "Inspect approved project facts from Kairo's current knowledge model.",
        emptyTitle = "No approved project facts",
        emptyBody = "Approved project knowledge will appear here after Memory Inbox review.",
        facts = knowledgeFacts,
        onOpenEvidence = onOpenEvidence,
        onBack = onBack,
    )
}

@Composable
private fun KnowledgeDestination(
    knowledgeFacts: List<FactVersion>,
    onOpenEvidence: (String) -> Unit,
    onBack: () -> Unit,
) {
    FactsDestination(
        title = "Knowledge overview",
        subtitle = "Inspect Kairo's current approved understanding.",
        emptyTitle = "No approved knowledge",
        emptyBody = "Approved facts will appear here after Memory Inbox review.",
        facts = knowledgeFacts,
        onOpenEvidence = onOpenEvidence,
        onBack = onBack,
    )
}

@Composable
private fun FactsDestination(
    title: String,
    subtitle: String,
    emptyTitle: String,
    emptyBody: String,
    facts: List<FactVersion>,
    onOpenEvidence: (String) -> Unit,
    onBack: () -> Unit,
) {
    ScreenScaffold(
        title = title,
        subtitle = subtitle,
        onBack = onBack,
    ) {
        if (facts.isEmpty()) {
            StatusCard(
                title = emptyTitle,
                body = emptyBody,
            )
        }
        facts.forEach { fact ->
            FactCard(
                fact = fact,
                onOpenEvidence = onOpenEvidence,
            )
        }
    }
}

@Composable
private fun FactCard(
    fact: FactVersion,
    onOpenEvidence: (String) -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            val value = when (val objectValue = fact.objectValue) {
                is FactObject.Literal -> objectValue.value
                is FactObject.Entity -> objectValue.value.value
            }
            Text(value, fontWeight = FontWeight.SemiBold)
            Text(fact.state.name)
            fact.evidence.firstOrNull()?.let { evidence ->
                TextButton(onClick = { onOpenEvidence(evidence.sourceId) }) {
                    Text("Open evidence")
                }
            }
        }
    }
}

@Composable
private fun SourcesDestination(
    evidenceSources: List<EvidenceRef>,
    selectedSourceId: String?,
    onBack: () -> Unit,
) {
    val visibleSources =
        if (selectedSourceId == null) {
            evidenceSources
        } else {
            evidenceSources.filter { it.sourceId == selectedSourceId }
        }

    ScreenScaffold(
        title = "Sources overview",
        subtitle = "Inspect evidence provenance behind approved Kairo knowledge.",
        onBack = onBack,
    ) {
        Text(
            text = "Evidence sources",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )

        if (visibleSources.isEmpty()) {
            StatusCard(
                title = "No evidence sources",
                body = "Approved knowledge has no source references to display yet.",
            )
        }

        visibleSources.forEach { source ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(source.sourceId, fontWeight = FontWeight.SemiBold)
                    source.anchor?.let { Text(it) }
                    source.extractionConfidence?.let {
                        Text("Confidence ${(it * 100).toInt()}%")
                    }
                }
            }
        }
    }
}

@Composable
private fun MemoryInboxDestination(
    memoryInbox: MemoryInboxService?,
    onApproveMemory: (suspend (MemoryCandidateId, String) -> Unit)?,
    onBack: () -> Unit,
) {
    var refreshToken by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()

    ScreenScaffold(
        title = "Memory Inbox overview",
        subtitle = "Review captured knowledge before it becomes active evidence.",
        onBack = onBack,
    ) {
        refreshToken
        val pending = memoryInbox?.pending().orEmpty()

        if (pending.isEmpty()) {
            StatusCard(
                title = "Inbox clear",
                body = "No pending memory candidates.",
            )
        }

        pending.forEach { candidate ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(candidate.draft.text)
                    Button(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            scope.launch {
                                val approve = onApproveMemory
                                if (approve != null) {
                                    approve(candidate.id, "LOCAL_OWNER")
                                } else {
                                    memoryInbox?.approve(
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
    }
}

@Composable
private fun CaptureDestination(
    knowledgeCapture: KnowledgeCapture?,
    containsLikelyPhi: Boolean,
    onSensitiveContentChoice: ((UserSensitiveChoice) -> Unit)?,
    onBack: () -> Unit,
) {
    var subject by remember { mutableStateOf("") }
    var predicate by remember { mutableStateOf("") }
    var value by remember { mutableStateOf("") }
    var saveStatus by remember { mutableStateOf<String?>(null) }
    var sensitiveChoiceHandled by remember(containsLikelyPhi) { mutableStateOf(!containsLikelyPhi) }
    val scope = rememberCoroutineScope()

    ScreenScaffold(
        title = "Capture intake",
        subtitle = "Capture a structured fact for review in Memory Inbox.",
        onBack = onBack,
    ) {
        if (containsLikelyPhi && !sensitiveChoiceHandled) {
            StatusCard(
                title = "Potential PHI detected",
                body = "Choose how Kairo should handle this sensitive capture before continuing.",
            )
            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    onSensitiveContentChoice?.invoke(UserSensitiveChoice.REDACT)
                    sensitiveChoiceHandled = true
                },
            ) {
                Text("Redact and continue")
            }
            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    onSensitiveContentChoice?.invoke(UserSensitiveChoice.TEMPORARY_USE)
                    sensitiveChoiceHandled = true
                },
            ) {
                Text("Temporary use only")
            }
            TextButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    onSensitiveContentChoice?.invoke(UserSensitiveChoice.CANCEL)
                    onBack()
                },
            ) {
                Text("Cancel capture")
            }
            return@ScreenScaffold
        }

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = subject,
            onValueChange = { subject = it },
            label = { Text("Subject") },
            singleLine = true,
        )
        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = predicate,
            onValueChange = { predicate = it },
            label = { Text("Predicate") },
            singleLine = true,
        )
        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = value,
            onValueChange = { value = it },
            label = { Text("Fact") },
            minLines = 4,
        )
        Button(
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                val capture = knowledgeCapture ?: return@Button
                val request = KnowledgeCaptureRequest(subject.trim(), predicate.trim(), value.trim())
                if (request.subject.isEmpty() || request.predicate.isEmpty() || request.value.isEmpty()) return@Button

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
            StatusCard(
                title = it,
                body = if (it == "Saved") "Capture is waiting for review in Memory Inbox." else "Persisting local capture.",
            )
        }
    }
}
