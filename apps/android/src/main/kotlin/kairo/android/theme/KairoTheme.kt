package kairo.android.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val KairoDarkColors =
    darkColorScheme(
        background = Color(0xFF0B0D10),
        surface = Color(0xFF11151A),
        onBackground = Color(0xFFF2F4F7),
        onSurface = Color(0xFFF2F4F7),
        primary = Color(0xFFB8C2CC),
        onPrimary = Color(0xFF11151A),
        secondary = Color(0xFF8FA3B8),
        onSecondary = Color(0xFF11151A),
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
