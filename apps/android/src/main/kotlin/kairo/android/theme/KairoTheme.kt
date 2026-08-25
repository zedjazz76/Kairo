package kairo.android.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.material3.Typography
import androidx.compose.material3.Shapes
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp
import kairo.android.R

private val GuardianColorScheme =
    lightColorScheme(
        background = GuardianColors.White,
        surface = GuardianColors.White,
        surfaceVariant = GuardianColors.FrostSilver,
        onBackground = GuardianColors.Ink,
        onSurface = GuardianColors.Ink,
        onSurfaceVariant = GuardianColors.MutedInk,
        primary = GuardianColors.Cyan,
        onPrimary = GuardianColors.Black,
        primaryContainer = Color(0x3322D3C5),
        onPrimaryContainer = GuardianColors.Ink,
        secondary = GuardianColors.ClinicalBlue,
        onSecondary = GuardianColors.White,
        secondaryContainer = GuardianColors.FrostSilver,
        onSecondaryContainer = GuardianColors.Ink,
        tertiary = GuardianColors.Black,
        onTertiary = GuardianColors.White,
        outline = GuardianColors.SteelMist,
        outlineVariant = Color(0x886CA0B7),
    )

private val GuardianFont = FontFamily(Font(R.font.space_grotesk))

private val GuardianTypography = Typography().run {
    copy(
        displaySmall = displaySmall.copy(fontFamily = GuardianFont, fontWeight = FontWeight.SemiBold),
        headlineLarge = headlineLarge.copy(fontFamily = GuardianFont, fontWeight = FontWeight.SemiBold),
        headlineMedium = headlineMedium.copy(fontFamily = GuardianFont, fontWeight = FontWeight.SemiBold),
        headlineSmall = headlineSmall.copy(fontFamily = GuardianFont, fontWeight = FontWeight.SemiBold),
        titleLarge = titleLarge.copy(fontFamily = GuardianFont, fontWeight = FontWeight.SemiBold),
        titleMedium = titleMedium.copy(fontFamily = GuardianFont, fontWeight = FontWeight.Medium),
        bodyLarge = bodyLarge.copy(fontFamily = GuardianFont),
        bodyMedium = bodyMedium.copy(fontFamily = GuardianFont),
        labelLarge = labelLarge.copy(fontFamily = GuardianFont, fontWeight = FontWeight.SemiBold),
        labelMedium = labelMedium.copy(fontFamily = GuardianFont, fontWeight = FontWeight.Medium),
    )
}

private val GuardianShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(22.dp),
    extraLarge = RoundedCornerShape(28.dp),
)

@Composable
fun KairoTheme(
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = GuardianColorScheme,
        typography = GuardianTypography,
        shapes = GuardianShapes,
        content = content,
    )
}
