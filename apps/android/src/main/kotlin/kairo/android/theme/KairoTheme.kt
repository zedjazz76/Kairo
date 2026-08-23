package kairo.android.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val KairoClinicalColors =
    lightColorScheme(
        background = Color(0xFFF4F6F8),
        surface = Color(0xFFFBFCFD),
        surfaceVariant = Color(0xFFE9EEF2),
        onBackground = Color(0xFF24313A),
        onSurface = Color(0xFF24313A),
        onSurfaceVariant = Color(0xFF5A6872),
        primary = Color(0xFF3A7D7A),
        onPrimary = Color(0xFFF9FFFF),
        primaryContainer = Color(0xFFD8ECE9),
        onPrimaryContainer = Color(0xFF173B39),
        secondary = Color(0xFF6879A8),
        onSecondary = Color(0xFFFFFFFF),
        secondaryContainer = Color(0xFFE2E6F5),
        onSecondaryContainer = Color(0xFF2E395B),
        tertiary = Color(0xFF8A6C91),
        onTertiary = Color(0xFFFFFFFF),
        outline = Color(0xFF9AA7B0),
        outlineVariant = Color(0xFFD1D9DE),
    )

@Composable
fun KairoTheme(
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = KairoClinicalColors,
        content = content,
    )
}
