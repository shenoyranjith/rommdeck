package dev.rommdeck.desktop

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.rommdeck.shared.config.RommDeckConfig
import dev.rommdeck.shared.config.UI_THEMES
import dev.rommdeck.shared.config.UiTheme
import dev.rommdeck.shared.config.createConfigRepository
import dev.rommdeck.shared.play.ResolvedPlayPaths

@Composable
fun SettingsScreen(
    config: RommDeckConfig,
    paths: ResolvedPlayPaths,
    section: SettingsSection,
    onSectionChange: (SettingsSection) -> Unit,
    onConfigChange: (RommDeckConfig) -> Unit,
    onNotice: OnNotice,
) {
    val c = Rd
    var platformMapEditing by remember { mutableStateOf(false) }

    LaunchedEffect(section) {
        if (section != SettingsSection.ROMM) {
            platformMapEditing = false
        }
    }

    Column(Modifier.fillMaxSize()) {
        Text("Settings", color = c.text, style = RdType.title, modifier = Modifier.padding(bottom = 16.dp))
        Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Column(Modifier.width(152.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                SettingsSection.entries.forEach { item ->
                    RdNavItem(
                        selected = section == item,
                        label = item.label,
                        onClick = { onSectionChange(item) },
                        compact = true,
                        leading = {
                            Icon(
                                item.icon,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp),
                                tint = if (section == item) c.accent else c.text,
                            )
                        },
                    )
                }
            }
            Column(
                Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .then(
                        if (!platformMapEditing) {
                            Modifier.verticalScroll(rememberScrollState())
                        } else {
                            Modifier
                        },
                    ),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                when (section) {
                    SettingsSection.APPEARANCE -> AppearanceSettings(config, onConfigChange)
                    SettingsSection.ROMM -> RommSettings(
                        config = config,
                        onConfigChange = onConfigChange,
                        onNotice = onNotice,
                        onPlatformMapEditingChange = { platformMapEditing = it },
                    )
                    SettingsSection.PLAY -> PlaySettings(config, paths, onConfigChange)
                    SettingsSection.AUTO_SYNC -> AutoSyncSettings(config, onConfigChange, onNotice)
                    SettingsSection.LOGGING -> LoggingSettings(config, onConfigChange, onNotice)
                }
            }
        }
    }
}

@Composable
private fun AppearanceSettings(config: RommDeckConfig, onConfigChange: (RommDeckConfig) -> Unit) {
    val repo = remember { createConfigRepository() }
    val c = Rd
    RdPanel {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("Color scheme and shell effects. Saved automatically.", color = c.muted, style = RdType.small)
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                UI_THEMES.forEach { theme ->
                    val colors = rdColors(theme)
                    val active = config.ui.theme == theme
                    Column(
                        Modifier
                            .weight(1f)
                            .rdInteractive(
                                onClick = {
                                    val next = config.copy(ui = config.ui.copy(theme = theme))
                                    repo.save(next)
                                    onConfigChange(next)
                                },
                                hoverBackground = colors.accent.copy(alpha = 0.1f),
                            )
                            .border(1.dp, if (active) colors.accent else c.line, RectangleShape),
                    ) {
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .aspectRatio(4f / 3f)
                                .background(
                                    Brush.linearGradient(
                                        listOf(colors.bg1, mix(colors.accent, colors.bg1, 0.22f)),
                                    ),
                                ),
                            contentAlignment = Alignment.Center,
                        ) {
                            BrandMarkWithLetters(56.dp, colors.accent)
                            if (active) {
                                Box(
                                    Modifier
                                        .align(Alignment.TopEnd)
                                        .padding(8.dp)
                                        .size(24.dp)
                                        .border(1.dp, colors.accent, RectangleShape)
                                        .background(colors.bg0.copy(alpha = 0.9f)),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    RdIcon(RdIconKind.CHECK, colors.accent, 14.dp, 2.5f)
                                }
                            }
                        }
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .border(1.dp, if (active) colors.accent.copy(alpha = 0.5f) else c.line, RectangleShape)
                                .background(if (active) colors.accent.copy(alpha = 0.1f) else colors.bg0.copy(alpha = 0.8f))
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                        ) {
                            Text(themeLabel(theme), color = colors.text, style = RdType.body.copy(fontWeight = FontWeight.SemiBold))
                            Text(theme.name.lowercase(), color = colors.muted, style = RdType.mono.copy(fontSize = 11.sp))
                        }
                    }
                }
            }
            Column(
                Modifier
                    .fillMaxWidth()
                    .border(1.dp, c.line, RectangleShape)
                    .background(c.bg0.copy(alpha = 0.5f))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("CRT scanlines", color = c.text, style = RdType.body.copy(fontWeight = FontWeight.SemiBold))
                        Text("Horizontal overlay on the app shell", color = c.muted, style = RdType.small)
                    }
                    RdSwitch(
                        checked = config.ui.scanlines,
                        onCheckedChange = {
                            val next = config.copy(ui = config.ui.copy(scanlines = it))
                            repo.save(next)
                            onConfigChange(next)
                        },
                    )
                }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("Overlay strength", color = c.text, style = RdType.body.copy(fontWeight = FontWeight.SemiBold), modifier = Modifier.weight(1f))
                    RdField(
                        value = config.ui.scanlineStrength.toString(),
                        onValueChange = { raw ->
                            val n = raw.toIntOrNull()?.coerceIn(0, 100) ?: return@RdField
                            val next = config.copy(ui = config.ui.copy(scanlineStrength = n))
                            repo.save(next)
                            onConfigChange(next)
                        },
                        enabled = config.ui.scanlines,
                        modifier = Modifier.width(72.dp),
                    )
                }
            }
        }
    }
}

private fun mix(a: Color, b: Color, amount: Float): Color {
    val t = amount.coerceIn(0f, 1f)
    return Color(
        red = a.red * t + b.red * (1 - t),
        green = a.green * t + b.green * (1 - t),
        blue = a.blue * t + b.blue * (1 - t),
        alpha = 1f,
    )
}

private fun themeLabel(theme: UiTheme): String = when (theme) {
    UiTheme.CANDY -> "Candy"
    UiTheme.GOLD -> "Gold"
    UiTheme.VECTOR -> "Vector"
    UiTheme.MINT -> "Mint"
}

private val SettingsSection.icon: ImageVector
    get() = when (this) {
        SettingsSection.APPEARANCE -> Icons.Filled.Palette
        SettingsSection.ROMM -> Icons.Filled.Storage
        SettingsSection.PLAY -> Icons.Filled.SportsEsports
        SettingsSection.AUTO_SYNC -> Icons.Filled.Sync
        SettingsSection.LOGGING -> Icons.Filled.Description
    }
