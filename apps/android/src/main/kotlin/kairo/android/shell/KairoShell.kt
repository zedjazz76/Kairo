package kairo.android.shell

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kairo.android.guardian.GuardianCard
import kairo.android.guardian.GuardianEmblem
import kairo.android.guardian.GuardianHero
import kairo.android.guardian.GuardianStatusChip
import kairo.android.guardian.GuardianWordmark
import kairo.android.guardian.GuardianActionCard
import kairo.android.guardian.GuardianAskCard
import kairo.android.guardian.GuardianBottomBar
import kairo.android.guardian.GuardianNotificationButton
import kairo.android.theme.GuardianColors
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
import kairo.domain.SourceId
import kairo.security.UserSensitiveChoice
import kotlinx.coroutines.launch
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountTree
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.Psychology
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material.icons.outlined.Hub
import androidx.compose.material.icons.outlined.ArrowBack

@Composable
fun KairoShell(
    connectivity: ConnectivityCapability,
    authenticationState: AuthenticationState = AuthenticationState.Locked,
    authenticator: Authenticator? = null,
    copilot: Copilot? = null,
    knowledgeCapture: KnowledgeCapture? = null,
    memoryInbox: MemoryInboxService? = null,
    onApproveMemory: (suspend (MemoryCandidateId, String) -> Unit)? = null,
    genesisSourceIds: Set<SourceId> = emptySet(),
    onApproveGenesis: (suspend () -> Unit)? = null,
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

        Scaffold(
            bottomBar = {
                GuardianBottomBar(
                    selected = when (destination) { KairoDestination.Home -> "home"; KairoDestination.Workflows -> "trace"; KairoDestination.Knowledge -> "memory"; KairoDestination.MemoryInbox -> "inbox"; else -> "" },
                    onHome = { navigateTo(KairoDestination.Home) },
                    onTrace = { navigateTo(KairoDestination.Workflows) },
                    onCapture = { navigateTo(KairoDestination.Capture) },
                    onMemory = { navigateTo(KairoDestination.Knowledge) },
                    onInbox = { navigateTo(KairoDestination.MemoryInbox) },
                )
            },
        ) { shellPadding ->
        Surface(modifier = Modifier.padding(shellPadding), color = MaterialTheme.colorScheme.background) {
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
                TraceWorkflowDestination(
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
                    genesisSourceIds = genesisSourceIds,
                    onApproveGenesis = onApproveGenesis,
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
    }
}

@Composable
private fun LockedDestination(
    authenticator: Authenticator?,
    onUnlocked: () -> Unit,
    scope: kotlinx.coroutines.CoroutineScope,
) {
    Surface(modifier = Modifier.fillMaxSize(), color = GuardianColors.Black) {
        Column(
            modifier = Modifier.fillMaxSize().padding(28.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally,
        ) {
            GuardianHero(Modifier.fillMaxWidth().height(260.dp))
            Spacer(Modifier.height(10.dp))
            GuardianWordmark(dark = true)
            Spacer(Modifier.height(14.dp))
            Text("YOUR KNOWLEDGE. PROTECTED.", style = MaterialTheme.typography.labelLarge, color = GuardianColors.Cyan)
            Text("Unlock your local clinical intelligence.", style = MaterialTheme.typography.bodyMedium, color = GuardianColors.SteelMist)
            Spacer(Modifier.height(26.dp))
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
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                GuardianEmblem(Modifier.size(34.dp), dark = false)
                GuardianWordmark(compact = true)
            }
            GuardianNotificationButton()
        }
        Text(
            "Good morning, Robert",
            style = MaterialTheme.typography.titleLarge,
            color = GuardianColors.Ink,
        )
        Text(
            "Clinical Systems Copilot",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        GuardianAskCard(onClick = onCopilot, modifier = Modifier.fillMaxWidth())

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            GuardianActionCard("Trace Workflow", Icons.Outlined.AccountTree, onWorkflows, Modifier.weight(1f))
            GuardianActionCard("Capture", Icons.Outlined.CameraAlt, onCapture, Modifier.weight(1f))
            GuardianActionCard("Analyze", Icons.Outlined.Psychology, onDeepAnalyze, Modifier.weight(1f))
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            GuardianActionCard("Search Knowledge", Icons.Outlined.Search, onKnowledge, Modifier.weight(1f))
            GuardianActionCard("Recent Incidents", Icons.Outlined.WarningAmber, onSources, Modifier.weight(1f))
            GuardianActionCard("Systems Map", Icons.Outlined.Hub, onSystems, Modifier.weight(1f))
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            Text("TODAY'S FOCUS", style = MaterialTheme.typography.labelLarge)
            TextButton(onClick = onSources) { Text("View all") }
        }
        if (offline) StatusCard("Offline mode", "Local knowledge remains available. Deep reasoning is unavailable.")
        else GuardianCard(modifier = Modifier.fillMaxWidth()) { Text("No priority incidents in the current local view.", style = MaterialTheme.typography.bodyMedium); Text("Open evidence or trace a workflow to review scoped context.", style = MaterialTheme.typography.labelSmall, color = GuardianColors.MutedInk) }
    }
}

@Composable
private fun FeatureCard(
    title: String,
    body: String,
    action: String,
    onClick: () -> Unit,
) {
    GuardianCard(modifier = Modifier.fillMaxWidth()) {
            Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
            Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Button(onClick = onClick) { Text(action) }
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
        Text(
            title,
            style = MaterialTheme.typography.labelMedium,
            maxLines = 2,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun StatusCard(title: String, body: String) {
    GuardianCard(modifier = Modifier.fillMaxWidth()) {
            Text(title, fontWeight = FontWeight.SemiBold)
            Text(
                body,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
    }
}

@Composable
private fun ScreenScaffold(
    title: String,
    subtitle: String? = null,
    onBack: () -> Unit,
    compact: Boolean = false,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(if (compact) 16.dp else 20.dp),
        verticalArrangement = Arrangement.spacedBy(if (compact) 10.dp else 14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.Outlined.ArrowBack, contentDescription = "Back", tint = GuardianColors.Cyan) }
            Text("Back", style = MaterialTheme.typography.labelMedium, color = GuardianColors.Cyan)
        }
        Text(title, style = if (compact) MaterialTheme.typography.titleLarge else MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold)
        subtitle?.let { Text(it, style = if (compact) MaterialTheme.typography.bodySmall else MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
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

    Surface(color = GuardianColors.Black, shape = androidx.compose.foundation.shape.RoundedCornerShape(28.dp)) {
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
            GuardianCard(dark = true) { Text(line, color = GuardianColors.White) }
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
        title = "Trace Workflow",
        subtitle = "Follow approved workflow evidence from order through result.",
        emptyTitle = "No approved trace evidence",
        emptyBody = "Workflow evidence will appear here after Memory Inbox review.",
        facts = knowledgeFacts,
        onOpenEvidence = onOpenEvidence,
        onBack = onBack,
    )
}

@Composable
private fun TraceWorkflowDestination(
    knowledgeFacts: List<FactVersion>,
    onOpenEvidence: (String) -> Unit,
    onBack: () -> Unit,
) {
    ScreenScaffold(title = "Trace Workflow", subtitle = "Read-only evidence trace", onBack = onBack, compact = true) {
        GuardianCard { Text("Workflow context", style = MaterialTheme.typography.titleSmall); Text("No patient or order identifiers are shown in this local view.", style = MaterialTheme.typography.labelSmall, color = GuardianColors.MutedInk) }
        listOf("Order", "RIS", "DMWL", "Modality", "PACS", "Reporting", "Result").forEachIndexed { index, label ->
            TraceStageRow(index = index, label = label, isLast = index == 6)
        }
        Button(modifier = Modifier.fillMaxWidth(), onClick = {}) { Text("Run Trace") }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) { OutlinedButton(modifier = Modifier.weight(1f), onClick = {}) { Text("Save Trace") }; OutlinedButton(modifier = Modifier.weight(1f), onClick = {}) { Text("Share") } }
        Text("EVIDENCE TIMELINE", style = MaterialTheme.typography.labelLarge)
        if (knowledgeFacts.isEmpty()) StatusCard("No trace events", "Open evidence-backed workflow knowledge to populate this timeline.") else knowledgeFacts.take(3).forEach { FactCard(it, onOpenEvidence) }
    }
}

@Composable
private fun TraceStageRow(index: Int, label: String, isLast: Boolean) {
    val completed = index == 0
    val current = index == 1
    val accent = when {
        completed -> GuardianColors.ClinicalBlue
        current -> GuardianColors.Cyan
        else -> GuardianColors.SteelMist
    }
    val state = when {
        completed -> "OBSERVED"
        current -> "VERIFY"
        else -> "PENDING"
    }
    val detail = when {
        completed -> "Evidence context available"
        current -> "Validation is next"
        else -> "Awaiting trace evidence"
    }
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(38.dp)) {
            Surface(color = accent, shape = CircleShape, modifier = Modifier.size(30.dp)) {
                Box(contentAlignment = Alignment.Center) {
                    Text((index + 1).toString(), style = MaterialTheme.typography.labelSmall, color = if (current) GuardianColors.Black else GuardianColors.White)
                }
            }
            if (!isLast) Box(Modifier.width(2.dp).height(24.dp).background(GuardianColors.SteelMist.copy(alpha = .75f)))
        }
        Column(modifier = Modifier.weight(1f).padding(start = 8.dp, bottom = if (isLast) 0.dp else 6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.titleSmall)
                GuardianStatusChip(state)
            }
            Text(detail, style = MaterialTheme.typography.labelSmall, color = GuardianColors.MutedInk)
        }
    }
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
    var query by remember { mutableStateOf("") }
    ScreenScaffold(title = "Knowledge", subtitle = "Approved evidence vault", onBack = onBack, compact = true) {
        OutlinedTextField(modifier = Modifier.fillMaxWidth(), value = query, onValueChange = { query = it }, label = { Text("Search knowledge vault…") }, singleLine = true)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("All", "Observed", "Confirmed", "Planned", "VERIFY").forEach { GuardianStatusChip(it) }
        }
        if (knowledgeFacts.isEmpty()) StatusCard("No approved knowledge", "Approved facts will appear here after Memory Inbox review.")
        knowledgeFacts.filter { query.isBlank() || it.toString().contains(query, ignoreCase = true) }.forEach { FactCard(it, onOpenEvidence) }
    }
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
    GuardianCard(modifier = Modifier.fillMaxWidth()) {
            val value = when (val objectValue = fact.objectValue) {
                is FactObject.Literal -> objectValue.value
                is FactObject.Entity -> objectValue.value.value
            }
            Text(value, fontWeight = FontWeight.SemiBold)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                GuardianStatusChip(fact.state.name)
                GuardianStatusChip(fact.scope.name)
            }
            fact.evidence.firstOrNull()?.let { evidence ->
                TextButton(onClick = { onOpenEvidence(evidence.sourceId) }) {
                    Text("Open evidence")
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
            GuardianCard(modifier = Modifier.fillMaxWidth()) {
                    Text(source.sourceId, fontWeight = FontWeight.SemiBold)
                    source.anchor?.let { Text(it) }
                    source.extractionConfidence?.let {
                        GuardianStatusChip("Confidence ${(it * 100).toInt()}%")
                    }
            }
        }
    }
}

@Composable
private fun MemoryInboxDestination(
    memoryInbox: MemoryInboxService?,
    onApproveMemory: (suspend (MemoryCandidateId, String) -> Unit)?,
    genesisSourceIds: Set<SourceId>,
    onApproveGenesis: (suspend () -> Unit)?,
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
        val hasCuratedGenesisPending = pending.any { candidate ->
            candidate.draft.evidenceAnchors.any { anchor -> anchor.sourceId in genesisSourceIds }
        }

        if (hasCuratedGenesisPending && onApproveGenesis != null) {
            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    scope.launch {
                        onApproveGenesis()
                        refreshToken += 1
                    }
                },
            ) {
                Text("Approve curated Genesis knowledge")
            }
        }

        if (pending.isEmpty()) {
            StatusCard(
                title = "Inbox clear",
                body = "No pending memory candidates.",
            )
        }

        pending.forEach { candidate ->
            GuardianCard(modifier = Modifier.fillMaxWidth()) {
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
