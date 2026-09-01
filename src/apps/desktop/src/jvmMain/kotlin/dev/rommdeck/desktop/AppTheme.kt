package dev.rommdeck.desktop

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalMinimumInteractiveComponentSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.platform.Font
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.sp
import dev.rommdeck.shared.config.UiTheme

data class RdColors(
    val bg0: Color,
    val bg1: Color,
    val bg2: Color,
    val bg3: Color,
    val line: Color,
    val text: Color,
    val muted: Color,
    val accent: Color,
    val accentDim: Color,
    val accentFg: Color,
    val warn: Color,
    val danger: Color,
    val ok: Color,
)

fun rdColors(theme: UiTheme): RdColors = when (theme) {
    UiTheme.CANDY -> RdColors(
        bg0 = Color(0xFF050508),
        bg1 = Color(0xFF0C0C12),
        bg2 = Color(0xFF14141C),
        bg3 = Color(0xFF1C1C28),
        line = Color(0xFF5A2040),
        text = Color(0xFFF4F0F5),
        muted = Color(0xFFA898A8),
        accent = Color(0xFFFF2D95),
        accentDim = Color(0xFFB01F68),
        accentFg = Color(0xFF14030C),
        warn = Color(0xFFE6B84D),
        danger = Color(0xFFFF6B6B),
        ok = Color(0xFF6BCF7F),
    )
    UiTheme.GOLD -> RdColors(
        bg0 = Color(0xFF080705),
        bg1 = Color(0xFF100E0A),
        bg2 = Color(0xFF1A1610),
        bg3 = Color(0xFF242018),
        line = Color(0xFF6A5520),
        text = Color(0xFFF5F0E6),
        muted = Color(0xFFA89878),
        accent = Color(0xFFE6B84D),
        accentDim = Color(0xFF9A7A28),
        accentFg = Color(0xFF140F05),
        warn = Color(0xFFE6B84D),
        danger = Color(0xFFE26D6D),
        ok = Color(0xFF6BCF7F),
    )
    UiTheme.VECTOR -> RdColors(
        bg0 = Color(0xFF050505),
        bg1 = Color(0xFF0C0C0C),
        bg2 = Color(0xFF141414),
        bg3 = Color(0xFF1C1C1C),
        line = Color(0xFF6A2020),
        text = Color(0xFFF5F0F0),
        muted = Color(0xFFA88888),
        accent = Color(0xFFFF3B3B),
        accentDim = Color(0xFFA82828),
        accentFg = Color(0xFF140505),
        warn = Color(0xFFE6B84D),
        danger = Color(0xFFFF6B6B),
        ok = Color(0xFF6BCF7F),
    )
    UiTheme.MINT -> RdColors(
        bg0 = Color(0xFF05080A),
        bg1 = Color(0xFF0A1014),
        bg2 = Color(0xFF121A20),
        bg3 = Color(0xFF1A2430),
        line = Color(0xFF1F5A50),
        text = Color(0xFFE8F6F2),
        muted = Color(0xFF7FA098),
        accent = Color(0xFF3DFFC8),
        accentDim = Color(0xFF1F8F72),
        accentFg = Color(0xFF041210),
        warn = Color(0xFFE6B84D),
        danger = Color(0xFFE26D6D),
        ok = Color(0xFF6BCF7F),
    )
}

val plexSans: FontFamily = FontFamily(
    Font("fonts/IBMPlexSans-Regular.ttf", FontWeight.Normal),
    Font("fonts/IBMPlexSans-Medium.ttf", FontWeight.Medium),
    Font("fonts/IBMPlexSans-SemiBold.ttf", FontWeight.SemiBold),
    Font("fonts/IBMPlexSans-Bold.ttf", FontWeight.Bold),
)

val plexMono: FontFamily = FontFamily(
    Font("fonts/IBMPlexMono-Regular.ttf", FontWeight.Normal),
    Font("fonts/IBMPlexMono-Medium.ttf", FontWeight.Medium),
)

val LocalRdColors = staticCompositionLocalOf { rdColors(UiTheme.CANDY) }

val Rd: RdColors
    @Composable get() = LocalRdColors.current

object RdType {
    val title = TextStyle(fontFamily = plexSans, fontWeight = FontWeight.SemiBold, fontSize = 28.sp, letterSpacing = 0.6.sp)
    val brand = TextStyle(fontFamily = plexSans, fontWeight = FontWeight.Bold, fontSize = 30.sp, letterSpacing = 0.8.sp)
    val nav = TextStyle(fontFamily = plexSans, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
    val body = TextStyle(fontFamily = plexSans, fontWeight = FontWeight.Normal, fontSize = 14.sp)
    val small = TextStyle(fontFamily = plexSans, fontWeight = FontWeight.Normal, fontSize = 13.sp)
    val micro = TextStyle(fontFamily = plexSans, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, letterSpacing = 1.4.sp)
    val mono = TextStyle(fontFamily = plexMono, fontWeight = FontWeight.Normal, fontSize = 12.sp)
    val field = TextStyle(fontFamily = plexSans, fontWeight = FontWeight.Normal, fontSize = 14.sp)
}

private val Sharp = RoundedCornerShape(0)

@Composable
fun AppTheme(
    theme: UiTheme,
    content: @Composable () -> Unit,
) {
    val colors = rdColors(theme)
    val scheme = darkColorScheme(
        primary = colors.accent,
        onPrimary = colors.accentFg,
        secondary = colors.accentDim,
        onSecondary = colors.accentFg,
        background = colors.bg0,
        onBackground = colors.text,
        surface = colors.bg1,
        onSurface = colors.text,
        surfaceVariant = colors.bg2,
        onSurfaceVariant = colors.muted,
        error = colors.danger,
        onError = colors.accentFg,
        outline = colors.line,
        inverseSurface = colors.bg2,
        inverseOnSurface = colors.text,
    )
    val type = Typography(
        bodyLarge = RdType.body.copy(color = colors.text),
        bodyMedium = RdType.body.copy(color = colors.text),
        bodySmall = RdType.small.copy(color = colors.muted),
        titleLarge = RdType.title.copy(color = colors.text),
        titleMedium = RdType.nav.copy(color = colors.text),
        labelSmall = RdType.micro.copy(color = colors.accent),
        labelLarge = RdType.body.copy(color = colors.text, fontWeight = FontWeight.SemiBold),
    )
    val scaled = LocalDensity.current.let { base ->
        remember(base) { Density(base.density * uiScale(), base.fontScale) }
    }
    CompositionLocalProvider(
        LocalRdColors provides colors,
        // Compose runs under XWayland at 1x, so a fractional compositor scale
        // (KDE/GNOME HiDPI) has to be applied by hand or the whole UI renders small.
        LocalDensity provides scaled,
        // M3 pads controls to a 48dp touch target; on desktop that reads as oversized.
        LocalMinimumInteractiveComponentSize provides Dp.Unspecified,
    ) {
        MaterialTheme(
            colorScheme = scheme,
            typography = type,
            shapes = Shapes(
                extraSmall = Sharp,
                small = Sharp,
                medium = Sharp,
                large = Sharp,
                extraLarge = Sharp,
            ),
            content = content,
        )
    }
}
