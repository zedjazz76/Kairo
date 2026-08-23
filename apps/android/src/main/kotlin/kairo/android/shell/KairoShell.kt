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
import androidx.compose.foundation.layout.width
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
import kairo.application.MemoryCandidateId
import kairo.application.MemoryInboxService
import kairo.domain.EvidenceRef
import kairo.domain.FactObject
import kairo.domain.FactVersion
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
) {
    var state by remember(authenticationState) { mutableStateOf(authenticationState) }
    val navigator = remember { KairoNavigator() }
    var destination by remember { mutableStateOf(navigator.destination) }

    fun navigateTo(target: KairoDestination) {
        navigator.navigateTo(target)
        destination = navigator.destination
    }

    fun backHome() {
        navigator.backHome()
        destination = navigator.destination
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
                    onSources = { navigateTo(KairoDestination.Sources) },
                    onMemoryInbox = { navigateTo(KairoDestination.MemoryInbox) },
                    onCopilot = { navigateTo(KairoDestination.Copilot) },
                    onDeepAnalyze = { navigateTo(KairoDestination.DeepAnalyze) },
                )

            KairoDestination.Systems -> SystemsDestination(knowledgeFacts, ::backHome)
            KairoDestination.Workflows -> WorkflowsDestination(knowledgeFacts, ::backHome)
            KairoDestination.Projects -> ProjectsDestination(knowledgeFacts, ::backHome)
            KairoDestination.Knowledge -> KnowledgeDestination(knowledgeFacts, ::backHome)
            KairoDestination.Capture -> CaptureDestination(knowledgeCapture, ::backHome)
            KairoDestination.Sources -> SourcesDestination(evidenceSources, ::backHome)
            KairoDestination.MemoryInbox -> MemoryInboxDestination(memoryInbox, onApproveMemory, ::backHome)
            KairoDestination.Copilot -> CopilotDestination(copilot, ::backHome)
            KairoDestination.DeepAnalyze -> DeepAnalyzeDestination(deepAnalyze, ::backHome)
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
        Text("KAIRO", style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text("Clinical Systems Copilot", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(28.dp))
        Button(
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                val auth = authenticator ?: return@Button
                scope.launch { if (auth.authenticate()) onUnlocked() }
            },
            enabled = authenticator != null,
        ) { Text("Unlock Kairo") }
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
        Text("Clinical Systems Copilot", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (offline) StatusCard("Offline mode", "Local knowledge remains available. Deep reasoning is unavailable.")
        FeatureCard("Copilot", "Ask Kairo about approved local clinical-systems knowledge.", "Ask Kairo", onCopilot)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            CompactAction(Modifier.weight(1f), "Capture", onCapture)
            CompactAction(Modifier.weight(1f), "Memory Inbox", onMemoryInbox)
        }
        Text("Knowledge workspace", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            CompactAction(Modifier.weight(1f), "Systems", onSystems)
            CompactAction(Modifier.weight(1f), "Workflows", onWorkflows)
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            CompactAction(Modifier.weight(1f), "Projects", onProjects)
            CompactAction(Modifier.weight(1f), "Knowledge", onKnowledge)
        }
        CompactAction(Modifier.fillMaxWidth(), "Sources", onSources)
        OutlinedButton(Modifier.fillMaxWidth(), onClick = onDeepAnalyze, enabled = !offline) { Text("Deep Analyze") }
    }
}

@Composable
private fun FeatureCard(title: String, body: String, action: String, onClick: () -> Unit) {
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
            Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Button(onClick = onClick) { Text(action) }
        }
    }
}

@Composable
private fun CompactAction(modifier: Modifier = Modifier, title: String, onClick: () -> Unit) {
    OutlinedButton(modifier, contentPadding = PaddingValues(horizontal = 14.dp, vertical = 14.dp), onClick = onClick) { Text(title) }
}

@Composable
private fun StatusCard(title: String, body: String) {
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, fontWeight = FontWeight.SemiBold)
            Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun ScreenScaffold(title: String, subtitle: String? = null, onBack: () -> Unit, content: @Composable () -> Unit) {
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
private fun CopilotDestination(copilot: Copilot?, onBack: () -> Unit) {
    var question by remember { mutableStateOf("") }
    var answer by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    ScreenScaffold("Kairo Copilot", "Ask against approved local knowledge.", onBack) {
        OutlinedTextField(Modifier.fillMaxWidth(), value = question, onValueChange = { question = it }, label = { Text("Ask Kairo") }, minLines = 3)
        Button(
            Modifier.fillMaxWidth(),
            onClick = {
                val activeCopilot = copilot ?: return@Button
                val submitted = question.trim()
                if (submitted.isEmpty()) return@Button
                scope.launch { answer = activeCopilot.ask(submitted) }
            },
            enabled = copilot != null,
        ) { Text("Send") }
        answer?.let { Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) { Text(it, modifier = Modifier.padding(16.dp)) } }
    }
}

@Composable
private fun DeepAnalyzeDestination(deepAnalyze: (suspend (String) -> String)?, onBack: () -> Unit) {
    var question by remember { mutableStateOf("") }
    var result by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    ScreenScaffold("Deep Analyze overview", "Run expanded diagnostic reasoning against the current Kairo evidence model.", onBack) {
        OutlinedTextField(Modifier.fillMaxWidth(), value = question, onValueChange = { question = it }, label = { Text("Analyze question") }, minLines = 3)
        Button(
            Modifier.fillMaxWidth(),
            onClick = {
                val analyze = deepAnalyze ?: return@Button
                val submitted = question.trim()
                if (submitted.isEmpty()) return@Button
                scope.launch { result = analyze(submitted) }
            },
            enabled = deepAnalyze != null && question.isNotBlank(),
        ) { Text("Analyze") }
        result?.lineSequence()?.filter { it.isNotBlank() }?.forEach { Text(it) }
    }
}

@Composable
private fun SystemsDestination(knowledgeFacts: List<FactVersion>, onBack: () -> Unit) =
    FactsDestination("Systems overview", "Inspect approved system facts from Kairo's current knowledge model.", "No approved system facts", "Approved system knowledge will appear here after Memory Inbox review.", knowledgeFacts, onBack)

@Composable
private fun WorkflowsDestination(knowledgeFacts: List<FactVersion>, onBack: () -> Unit) =
    FactsDestination("Workflows overview", "Inspect approved workflow facts from Kairo's current knowledge model.", "No approved workflow facts", "Approved workflow knowledge will appear here after Memory Inbox review.", knowledgeFacts, onBack)

@Composable
private fun ProjectsDestination(knowledgeFacts: List<FactVersion>, onBack: () -> Unit) =
    FactsDestination("Projects overview", "Inspect approved project facts from Kairo's current knowledge model.", "No approved project facts", "Approved project knowledge will appear here after Memory Inbox review.", knowledgeFacts, onBack)

@Composable
private fun KnowledgeDestination(knowledgeFacts: List<FactVersion>, onBack: () -> Unit) =
    FactsDestination("Knowledge overview", "Inspect Kairo's current approved understanding.", "No approved knowledge", "Approved facts will appear here after Memory Inbox review.", knowledgeFacts, onBack)

@Composable
private fun FactsDestination(title: String, subtitle: String, emptyTitle: String, emptyBody: String, facts: List<FactVersion>, onBack: () -> Unit) {
    ScreenScaffold(title, subtitle, onBack) {
        if (facts.isEmpty()) StatusCard(emptyTitle, emptyBody)
        facts.forEach { FactCard(it) }
    }
}

@Composable
private fun FactCard(fact: FactVersion) {
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            val value = when (val objectValue = fact.objectValue) {
                is FactObject.Literal -> objectValue.value
                is FactObject.Entity -> objectValue.value.value
            }
            Text(value, fontWeight = FontWeight.SemiBold)
            Text(fact.state.name)
        }
    }
}

@Composable
private fun SourcesDestination(evidenceSources: List<EvidenceRef>, onBack: () -> Unit) {
    ScreenScaffold("Sources overview", "Inspect evidence provenance behind approved Kairo knowledge.", onBack) {
        Text("Evidence sources", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        if (evidenceSources.isEmpty()) StatusCard("No evidence sources", "Approved knowledge has no source references to display yet.")
        evidenceSources.forEach { source ->
            Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(source.sourceId, fontWeight = FontWeight.SemiBold)
                    source.anchor?.let { Text(it) }
                    source.extractionConfidence?.let { Text("Confidence ${(it * 100).toInt()}%") }
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
    ScreenScaffold("Memory Inbox", "Review proposed memory before it becomes authoritative knowledge.", onBack) {
        refreshToken
        val pending = memoryInbox?.pending().orEmpty()
        if (pending.isEmpty()) StatusCard("Inbox clear", "No pending memory candidates.")
        pending.forEach { candidate ->
            Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(candidate.draft.text, fontWeight = FontWeight.SemiBold)
                    Button(
                        onClick = {
                            val approve = onApproveMemory ?: return@Button
                            scope.launch {
                                approve(candidate.id, "LOCAL_OWNER")
                                refreshToken += 1
                            }
                        },
                    ) { Text("Approve") }
                }
            }
        }
    }
}

@Composable
private fun CaptureDestination(knowledgeCapture: KnowledgeCapture?, onBack: () -> Unit) {
    var subject by remember { mutableStateOf("") }
    var predicate by remember { mutableStateOf("") }
    var value by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    ScreenScaffold("Capture", "Save a proposed knowledge candidate for review.", onBack) {
        OutlinedTextField(Modifier.fillMaxWidth(), value = subject, onValueChange = { subject = it }, label = { Text("Subject") })
        OutlinedTextField(Modifier.fillMaxWidth(), value = predicate, onValueChange = { predicate = it }, label = { Text("Predicate") })
        OutlinedTextField(Modifier.fillMaxWidth(), value = value, onValueChange = { value = it }, label = { Text("Value") }, minLines = 3)
        Button(
            Modifier.fillMaxWidth(),
            onClick = {
                val capture = knowledgeCapture ?: return@Button
                val s = subject.trim(); val p = predicate.trim(); val v = value.trim()
                if (s.isEmpty() || p.isEmpty() || v.isEmpty()) return@Button
                scope.launch { capture.save(KnowledgeCaptureRequest(subject = s, predicate = p, value = v)); subject = ""; predicate = ""; value = "" }
            },
            enabled = knowledgeCapture != null,
        ) { Text("Save for review") }
    }
}
