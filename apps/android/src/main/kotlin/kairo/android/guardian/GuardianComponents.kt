package kairo.android.guardian

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.FloatingActionButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.AccountTree
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.ui.graphics.vector.ImageVector
import kairo.android.R
import kairo.android.theme.GuardianColors

@Composable
fun GuardianWordmark(modifier: Modifier = Modifier, dark: Boolean = false, compact: Boolean = false) {
    val ink = if (dark) GuardianColors.White else GuardianColors.Black
    Column(
        modifier = modifier.semantics { contentDescription = "Kairo Guardian wordmark" }.testTag("guardian_wordmark"),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "K A I R O",
            style = if (compact) MaterialTheme.typography.titleMedium else MaterialTheme.typography.headlineLarge,
            color = ink,
            letterSpacing = if (compact) 3.sp else 6.sp,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(if (compact) 3.dp else 7.dp))
        Spacer(
            Modifier
                .size(width = if (compact) 28.dp else 42.dp, height = 1.dp)
                .background(GuardianColors.Cyan),
        )
    }
}

@Composable
fun GuardianEmblem(modifier: Modifier = Modifier, dark: Boolean = true) {
    Image(
        painter = painterResource(if (dark) R.drawable.guardian_icon_dark else R.drawable.guardian_icon_light),
        contentDescription = "Guardian emblem",
        modifier = modifier.clip(RoundedCornerShape(24.dp)),
        contentScale = ContentScale.Crop,
    )
}

@Composable
fun GuardianHero(modifier: Modifier = Modifier) {
    Image(
        painter = painterResource(R.drawable.guardian_hero),
        contentDescription = "Kairo Guardian",
        modifier = modifier,
        contentScale = ContentScale.Crop,
    )
}

@Composable
fun GuardianCard(
    modifier: Modifier = Modifier,
    dark: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    val container = if (dark) GuardianColors.Black else MaterialTheme.colorScheme.surfaceVariant
    val contentColor = if (dark) GuardianColors.White else MaterialTheme.colorScheme.onSurface
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(22.dp),
        border = BorderStroke(1.dp, if (dark) GuardianColors.ClinicalBlue.copy(alpha = .45f) else GuardianColors.SteelMist.copy(alpha = .72f)),
        colors = CardDefaults.cardColors(containerColor = container, contentColor = contentColor),
        elevation = CardDefaults.cardElevation(defaultElevation = if (dark) 6.dp else 1.dp),
    ) { Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp), content = content) }
}

@Composable
fun GuardianStatusChip(label: String, modifier: Modifier = Modifier) {
    val emphatic = label.contains("VERIFY") || label.contains("CONFIRMED") || label.contains("MANA_PRODUCTION")
    Text(
        text = label.replace('_', ' '),
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .background(if (emphatic) GuardianColors.Cyan.copy(alpha = .16f) else GuardianColors.FrostSilver)
            .padding(horizontal = 9.dp, vertical = 4.dp),
        style = MaterialTheme.typography.labelMedium,
        color = GuardianColors.Ink,
        fontWeight = FontWeight.SemiBold,
    )
}

@Composable
fun GuardianActionCard(label: String, icon: ImageVector, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, GuardianColors.SteelMist.copy(alpha = .7f)),
        colors = CardDefaults.cardColors(containerColor = GuardianColors.White),
        onClick = onClick,
    ) {
        Column(Modifier.padding(vertical = 12.dp, horizontal = 6.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Icon(icon, null, tint = GuardianColors.ClinicalBlue, modifier = Modifier.size(25.dp))
            Text(label, style = MaterialTheme.typography.labelSmall, textAlign = TextAlign.Center, maxLines = 2)
        }
    }
}

@Composable
fun GuardianAskCard(onClick: () -> Unit, modifier: Modifier = Modifier) {
    Card(modifier = modifier, onClick = onClick, shape = RoundedCornerShape(15.dp), border = BorderStroke(1.dp, GuardianColors.SteelMist.copy(alpha = .6f)), colors = CardDefaults.cardColors(containerColor = GuardianColors.White)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Ask KAIRO anything…", modifier = Modifier.weight(1f), color = GuardianColors.MutedInk, style = MaterialTheme.typography.bodyMedium)
                Icon(Icons.Outlined.Mic, "Ask with voice", tint = GuardianColors.ClinicalBlue)
            }
            Text("Example: Why is today's imaging workflow delayed?", style = MaterialTheme.typography.labelSmall, color = GuardianColors.ClinicalBlue)
        }
    }
}

@Composable
fun GuardianNotificationButton() = IconButton(onClick = {}) { Icon(Icons.Outlined.NotificationsNone, "Notifications", tint = GuardianColors.ClinicalBlue) }

@Composable
fun GuardianBottomBar(selected: String, onHome: () -> Unit, onTrace: () -> Unit, onCapture: () -> Unit, onMemory: () -> Unit, onInbox: () -> Unit) {
    Surface(color = GuardianColors.White, shadowElevation = 10.dp, modifier = Modifier.fillMaxWidth().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 5.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            GuardianNavItem("Home", Icons.Outlined.Home, selected == "home", onHome)
            GuardianNavItem("Trace", Icons.Outlined.AccountTree, selected == "trace", onTrace)
            FloatingActionButton(onClick = onCapture, containerColor = GuardianColors.Cyan, contentColor = GuardianColors.Black, modifier = Modifier.size(52.dp)) { Icon(Icons.Outlined.Add, "Capture") }
            GuardianNavItem("Memory", Icons.Outlined.BookmarkBorder, selected == "memory", onMemory)
            GuardianNavItem("Inbox", Icons.Outlined.Inbox, selected == "inbox", onInbox)
        }
    }
}

@Composable private fun GuardianNavItem(label: String, icon: ImageVector, selected: Boolean, onClick: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.clip(RoundedCornerShape(10.dp)).clickable(onClick = onClick).testTag("guardian_nav_${label.lowercase()}").padding(horizontal = 8.dp, vertical = 2.dp),
    ) {
        Icon(icon, label, tint = if (selected) GuardianColors.Cyan else GuardianColors.ClinicalBlue, modifier = Modifier.size(48.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = if (selected) GuardianColors.Cyan else GuardianColors.MutedInk)
    }
}
