package kairo.android.guardian

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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
import kairo.android.R
import kairo.android.theme.GuardianColors

@Composable
fun GuardianWordmark(modifier: Modifier = Modifier, dark: Boolean = false) {
    val ink = if (dark) GuardianColors.White else GuardianColors.Black
    Column(
        modifier = modifier.semantics { contentDescription = "Kairo Guardian wordmark" }.testTag("guardian_wordmark"),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "K A I R O",
            style = MaterialTheme.typography.headlineLarge,
            color = ink,
            letterSpacing = 6.sp,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(7.dp))
        Spacer(
            Modifier
                .size(width = 42.dp, height = 1.dp)
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
