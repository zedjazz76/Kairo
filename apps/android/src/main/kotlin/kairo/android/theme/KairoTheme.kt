package kairo.android.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val KairoDarkColors =
    darkColorScheme(
        background = Color(0xFF0B0D10),
        surface = Color(0xFF11151A),
        surfaceVariant = Color(0xFF1A2028),
        onBackground = Color(0xFFF2F4F7),
        onSurface = Color(0xFFF2F4F7),
        onSurfaceVariant = Color(0xFFD7DEE7),
        primary = Color(0xFFDCE3EA),
        onPrimary = Color(0xFF0B0D10),
        secondary = Color(0xFFAFC0D2),
        onSecondary = Color(0xFF0B0D10),
        outline = Color(0xFF7E8B99),
    )

@Composable
fun KairoTheme(
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = KairoDarkColors,
        content = content,
    )
}
