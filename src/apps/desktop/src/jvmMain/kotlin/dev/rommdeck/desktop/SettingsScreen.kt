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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.rommdeck.shared.config.ConflictPolicy
import dev.rommdeck.shared.config.LOG_LEVELS
import dev.rommdeck.shared.config.RommDeckConfig
import dev.rommdeck.shared.config.SyncMode
import dev.rommdeck.shared.config.UI_THEMES
import dev.rommdeck.shared.config.UiTheme
import dev.rommdeck.shared.config.createConfigRepository
import dev.rommdeck.shared.paths.AppPaths
import dev.rommdeck.shared.play.ResolvedPlayPaths
import dev.rommdeck.shared.romm.createRommClient
import dev.rommdeck.shared.sync.AutoSyncAction
import dev.rommdeck.shared.sync.controlAutoSyncService
import dev.rommdeck.shared.sync.installAutoSyncService
import dev.rommdeck.shared.sync.isAutoSyncServiceInstalled
import dev.rommdeck.shared.sync.readDaemonStatus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.awt.Desktop
import java.io.File

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
    Column(Modifier.fillMaxSize()) {
        Text("Settings", color = c.text, style = RdType.title, modifier = Modifier.padding(bottom = 16.dp))
        Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Column(Modifier.width(152.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                SettingsSection.entries.forEach { item ->
                    RdNavItem(
                        selected = section == item,
                        label = item.label,
                        icon = when (item) {
                            SettingsSection.APPEARANCE -> RdIconKind.SETTINGS
                            SettingsSection.ROMM -> RdIconKind.DATABASE
                            SettingsSection.PLAY -> RdIconKind.LIBRARY
                            SettingsSection.AUTO_SYNC -> RdIconKind.SYNC
                            SettingsSection.LOGGING -> RdIconKind.DRIVE
                        },
                        onClick = { onSectionChange(item) },
                        iconSize = 18.dp,
                        compact = true,
                    )
                }
            }
            Column(
                Modifier.weight(1f).fillMaxHeight().verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                when (section) {
                    SettingsSection.APPEARANCE -> AppearanceSettings(config, onConfigChange)
                    SettingsSection.ROMM -> RommSettings(config, onConfigChange, onNotice)
                    SettingsSection.PLAY -> PlaySettings(config, paths, onConfigChange, onNotice)
                    SettingsSection.AUTO_SYNC -> AutoSyncSettings(config, onConfigChange, onNotice)
                    SettingsSection.LOGGING -> LoggingSettings(config, onConfigChange)
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

@Composable
private fun RommSettings(
    config: RommDeckConfig,
    onConfigChange: (RommDeckConfig) -> Unit,
    onNotice: OnNotice,
) {
    val repo = remember { createConfigRepository() }
    val scope = rememberCoroutineScope()
    var baseUrl by remember(config.romm.baseUrl) { mutableStateOf(config.romm.baseUrl) }
    var apiToken by remember(config.romm.apiToken) { mutableStateOf(config.romm.apiToken) }
    var testing by remember { mutableStateOf(false) }

    RdPanel {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            RdField(baseUrl, { baseUrl = it }, label = "Base URL", placeholder = "https://romm.example")
            RdField(apiToken, { apiToken = it }, label = "API token")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                RdButton(
                    onClick = {
                        val next = config.copy(romm = config.romm.copy(baseUrl = baseUrl.trim(), apiToken = apiToken.trim()))
                        repo.save(next)
                        onConfigChange(next)
                        onNotice("RomM settings saved")
                    },
                    primary = true,
                ) { Text("Save", fontWeight = FontWeight.SemiBold) }
                RdButton(
                    onClick = {
                        testing = true
                        scope.launch {
                            try {
                                val result = withContext(Dispatchers.IO) {
                                    val client = createRommClient(baseUrl.trim(), apiToken.trim())
                                    try {
                                        client.testConnection()
                                    } finally {
                                        client.close()
                                    }
                                }
                                onNotice(
                                    if (result.ok) "Connected — ${result.platformCount ?: 0} platforms"
                                    else result.error ?: "Connection failed",
                                    if (result.ok) NotificationTone.Ok else NotificationTone.Err,
                                )
                            } catch (e: Exception) {
                                onNotice(e.message ?: e.toString(), NotificationTone.Err)
                            } finally {
                                testing = false
                            }
                        }
                    },
                    enabled = !testing && baseUrl.isNotBlank(),
                ) { Text(if (testing) "Testing…" else "Test connection") }
            }
        }
    }
}

@Composable
private fun PlaySettings(
    config: RommDeckConfig,
    paths: ResolvedPlayPaths,
    onConfigChange: (RommDeckConfig) -> Unit,
    onNotice: OnNotice,
) {
    val c = Rd
    val repo = remember { createConfigRepository() }
    var play by remember(config.playTarget) { mutableStateOf(config.playTarget) }
    RdPanel {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("ES-DE first. RetroDECK is used only when retrodeck.json is found (or you set its path).", color = c.muted, style = RdType.small)
            Text("Resolved source: ${paths.source}", color = c.accent, style = RdType.mono)
            RdField(play.configPath, { play = play.copy(configPath = it) }, label = "retrodeck.json (optional)", placeholder = "Auto-detect")
            RdField(play.romsPath, { play = play.copy(romsPath = it) }, label = "ROMs folder", placeholder = "Auto-detect")
            RdField(play.savesPath, { play = play.copy(savesPath = it) }, label = "Saves folder", placeholder = "Auto-detect")
            RdField(play.statesPath, { play = play.copy(statesPath = it) }, label = "States folder", placeholder = "Auto-detect")
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                RdSwitch(play.syncMetadataOnDownload, { play = play.copy(syncMetadataOnDownload = it) })
                Text("Write ES-DE gamelist.xml on download", color = c.text, style = RdType.body)
            }
            Text("Using ROMs: ${paths.romsPath.ifBlank { "(not set)" }}", color = c.muted, style = RdType.mono.copy(fontSize = 11.sp))
            Text("Using saves: ${paths.savesPath.ifBlank { "(not set)" }}", color = c.muted, style = RdType.mono.copy(fontSize = 11.sp))
            Text("Using states: ${paths.statesPath.ifBlank { "(not set)" }}", color = c.muted, style = RdType.mono.copy(fontSize = 11.sp))
            RdButton(
                onClick = {
                    val next = config.copy(playTarget = play)
                    repo.save(next)
                    onConfigChange(next)
                    onNotice("Play paths saved")
                },
                primary = true,
            ) { Text("Save", fontWeight = FontWeight.SemiBold) }
        }
    }
}

@Composable
private fun AutoSyncSettings(
    config: RommDeckConfig,
    onConfigChange: (RommDeckConfig) -> Unit,
    onNotice: OnNotice,
) {
    val c = Rd
    val repo = remember { createConfigRepository() }
    val scope = rememberCoroutineScope()
    var sync by remember(config.sync) { mutableStateOf(config.sync) }
    var serviceBusy by remember { mutableStateOf(false) }
    var unitInstalled by remember { mutableStateOf(isAutoSyncServiceInstalled()) }
    var daemon by remember { mutableStateOf(readDaemonStatus()) }

    LaunchedEffect(Unit) {
        unitInstalled = withContext(Dispatchers.IO) { isAutoSyncServiceInstalled() }
        daemon = withContext(Dispatchers.IO) { readDaemonStatus() }
    }

    fun persist(nextSync: dev.rommdeck.shared.config.SyncConfig = sync) {
        val next = config.copy(sync = nextSync)
        repo.save(next)
        onConfigChange(next)
    }

    RdPanel {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.weight(1f)) {
                    RdSwitch(
                        checked = sync.enabled,
                        enabled = !serviceBusy,
                        onCheckedChange = { enabled ->
                            serviceBusy = true
                            scope.launch {
                                try {
                                    withContext(Dispatchers.IO) {
                                        if (enabled && !isAutoSyncServiceInstalled()) {
                                            val installed = installAutoSyncService()
                                            if (!installed.ok) {
                                                onNotice(installed.output, NotificationTone.Err)
                                                return@withContext
                                            }
                                        }
                                        val nextSync = sync.copy(enabled = enabled)
                                        persist(nextSync)
                                        sync = nextSync
                                        val ctl = controlAutoSyncService(
                                            if (enabled) AutoSyncAction.ENABLE else AutoSyncAction.DISABLE,
                                        )
                                        onNotice(
                                            if (!ctl.ok) ctl.output
                                            else if (enabled) "Auto-sync enabled"
                                            else "Auto-sync disabled",
                                            if (ctl.ok) NotificationTone.Ok else NotificationTone.Err,
                                        )
                                    }
                                } finally {
                                    unitInstalled = isAutoSyncServiceInstalled()
                                    daemon = readDaemonStatus()
                                    serviceBusy = false
                                }
                            }
                        },
                    )
                    Text("Enable auto-sync sidecar", color = c.text, style = RdType.body.copy(fontWeight = FontWeight.SemiBold))
                }
                Text(
                    "Daemon: ${if (daemon.running) "running" else "stopped"}" +
                        (daemon.pid?.let { " pid $it" } ?: "") +
                        (if (unitInstalled) "" else " (not installed)"),
                    color = if (daemon.running) c.ok else c.muted,
                    style = RdType.small,
                )
            }
            RdField(sync.deviceName, { sync = sync.copy(deviceName = it) }, label = "Device name")
            Text("Sync direction", color = c.muted, style = RdType.small)
            RdChoiceRow(
                options = SyncMode.entries.map { syncModeLabel(it) },
                selectedIndex = SyncMode.entries.indexOf(sync.mode),
                onSelect = { sync = sync.copy(mode = SyncMode.entries[it]) },
            )
            RdField(
                sync.intervalSeconds.toString(),
                { it.toIntOrNull()?.let { n -> sync = sync.copy(intervalSeconds = n.coerceAtLeast(60)) } },
                label = "Interval (seconds)",
            )
            RdField(
                sync.debounceSeconds.toString(),
                { it.toIntOrNull()?.let { n -> sync = sync.copy(debounceSeconds = n.coerceAtLeast(5)) } },
                label = "Watch debounce (seconds)",
            )
            Text("Conflict policy", color = c.muted, style = RdType.small)
            RdChoiceRow(
                options = ConflictPolicy.entries.map { conflictLabel(it) },
                selectedIndex = ConflictPolicy.entries.indexOf(sync.conflictPolicy),
                onSelect = { sync = sync.copy(conflictPolicy = ConflictPolicy.entries[it]) },
            )
            Text("Device id: ${sync.deviceId ?: "not registered"}", color = c.muted, style = RdType.mono.copy(fontSize = 11.sp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                RdButton(onClick = { persist(); onNotice("Auto-sync settings saved") }, primary = true) {
                    Text("Save", fontWeight = FontWeight.SemiBold)
                }
                RdButton(
                    onClick = {
                        serviceBusy = true
                        scope.launch {
                            try {
                                val result = withContext(Dispatchers.IO) { installAutoSyncService() }
                                unitInstalled = isAutoSyncServiceInstalled()
                                onNotice(
                                    if (result.ok) result.output.ifBlank { "Installed" } else result.output,
                                    if (result.ok) NotificationTone.Ok else NotificationTone.Err,
                                )
                            } finally {
                                serviceBusy = false
                            }
                        }
                    },
                    enabled = !serviceBusy,
                ) { Text("Install sidecar") }
            }
        }
    }
}

@Composable
private fun LoggingSettings(config: RommDeckConfig, onConfigChange: (RommDeckConfig) -> Unit) {
    val c = Rd
    val repo = remember { createConfigRepository() }
    RdPanel {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Writes GUI, downloads, sync, and sidecar lines to a rotating file.", color = c.muted, style = RdType.small)
            Text("Log level", color = c.muted, style = RdType.small)
            RdChoiceRow(
                options = LOG_LEVELS.map { it.name.lowercase() },
                selectedIndex = LOG_LEVELS.indexOf(config.logging.level).coerceAtLeast(0),
                onSelect = {
                    val next = config.copy(logging = config.logging.copy(level = LOG_LEVELS[it]))
                    repo.save(next)
                    onConfigChange(next)
                },
            )
            Column(
                Modifier
                    .fillMaxWidth()
                    .border(1.dp, c.line, RectangleShape)
                    .background(c.bg0.copy(alpha = 0.5f))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("LOG FILE", color = c.muted, style = RdType.micro)
                Text(AppPaths.appLogFile(), color = c.text, style = RdType.mono.copy(fontSize = 11.sp))
                RdButton(
                    onClick = {
                        val file = File(AppPaths.appLogFile())
                        file.parentFile?.mkdirs()
                        if (!file.exists()) file.writeText("")
                        openFile(file)
                    },
                ) { Text("Open log file") }
            }
        }
    }
}

private fun themeLabel(theme: UiTheme): String = when (theme) {
    UiTheme.CANDY -> "Candy"
    UiTheme.GOLD -> "Gold"
    UiTheme.VECTOR -> "Vector"
    UiTheme.MINT -> "Mint"
}

private fun syncModeLabel(mode: SyncMode): String = when (mode) {
    SyncMode.PUSH_PULL -> "Two-way"
    SyncMode.PULL_ONLY -> "Download only"
    SyncMode.PUSH_ONLY -> "Upload only"
}

private fun conflictLabel(policy: ConflictPolicy): String = when (policy) {
    ConflictPolicy.KEEP_BOTH -> "Keep both"
    ConflictPolicy.SERVER_WINS -> "Prefer server"
    ConflictPolicy.DEVICE_WINS -> "Prefer this device"
}

private fun openFile(file: File) {
    try {
        if (Desktop.isDesktopSupported()) Desktop.getDesktop().open(file)
        else ProcessBuilder("xdg-open", file.absolutePath).start()
    } catch (_: Exception) {
        ProcessBuilder("xdg-open", file.absolutePath).start()
    }
}
