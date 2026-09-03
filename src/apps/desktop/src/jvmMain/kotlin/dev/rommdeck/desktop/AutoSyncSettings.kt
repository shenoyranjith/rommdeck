package dev.rommdeck.desktop

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckBox
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.outlined.CheckBoxOutlineBlank
import androidx.compose.material3.Icon
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
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.input.pointer.PointerIcon
import androidx.compose.ui.input.pointer.pointerHoverIcon
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.rommdeck.shared.config.ConflictPolicy
import dev.rommdeck.shared.config.RommDeckConfig
import dev.rommdeck.shared.config.SyncConfig
import dev.rommdeck.shared.config.SyncMode
import dev.rommdeck.shared.config.createConfigRepository
import dev.rommdeck.shared.config.saveSyncDaemonConfig
import dev.rommdeck.shared.sync.AutoSyncAction
import dev.rommdeck.shared.sync.DaemonStatus
import dev.rommdeck.shared.sync.controlAutoSyncService
import dev.rommdeck.shared.sync.installAutoSyncService
import dev.rommdeck.shared.sync.isAutoSyncServiceInstalled
import dev.rommdeck.shared.sync.readDaemonStatus
import dev.rommdeck.shared.sync.readInstalledSyncdVersion
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val SyncSaveDebounceMs = 400L
private const val DaemonPollMs = 5_000L

@Composable
fun AutoSyncSettings(
    config: RommDeckConfig,
    onConfigChange: (RommDeckConfig) -> Unit,
    onNotice: OnNotice,
) {
    val c = Rd
    val repo = remember { createConfigRepository() }
    val scope = rememberCoroutineScope()
    var saveJob by remember { mutableStateOf<Job?>(null) }
    var systemctlBusy by remember { mutableStateOf(false) }
    var installBusy by remember { mutableStateOf(false) }
    var unitInstalled by remember { mutableStateOf<Boolean?>(null) }
    var daemon by remember { mutableStateOf<DaemonStatus?>(null) }
    var installedSyncdVersion by remember { mutableStateOf<String?>(null) }
    var advancedExpanded by remember { mutableStateOf(false) }
    val sync = config.sync

    LaunchedEffect(Unit) {
        while (isActive) {
            unitInstalled = withContext(Dispatchers.IO) { isAutoSyncServiceInstalled() }
            daemon = withContext(Dispatchers.IO) { readDaemonStatus() }
            installedSyncdVersion = withContext(Dispatchers.IO) { readInstalledSyncdVersion() }
            delay(DaemonPollMs)
        }
    }

    fun persistSyncDebounced(nextSync: SyncConfig) {
        val next = config.copy(sync = nextSync)
        onConfigChange(next)
        saveJob?.cancel()
        saveJob = scope.launch {
            delay(SyncSaveDebounceMs)
            withContext(Dispatchers.IO) { repo.saveSyncDaemonConfig(next) }
        }
    }

    fun persistSyncImmediate(nextSync: SyncConfig) {
        saveJob?.cancel()
        val next = config.copy(sync = nextSync)
        onConfigChange(next)
        scope.launch {
            withContext(Dispatchers.IO) { repo.saveSyncDaemonConfig(next) }
        }
    }

    RdPanel {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.weight(1f),
                ) {
                    RdSwitch(
                        checked = sync.enabled,
                        enabled = !systemctlBusy,
                        onCheckedChange = { enabled ->
                            systemctlBusy = true
                            scope.launch {
                                try {
                                    withContext(Dispatchers.IO) {
                                        if (enabled && unitInstalled != true) {
                                            val installed = installAutoSyncService()
                                            if (!installed.ok) {
                                                onNotice(
                                                    installed.output.ifBlank { "Failed to install sync daemon" },
                                                    NotificationTone.Err,
                                                )
                                                return@withContext
                                            }
                                        }
                                        val nextSync = sync.copy(enabled = enabled)
                                        repo.saveSyncDaemonConfig(config.copy(sync = nextSync))
                                        onConfigChange(config.copy(sync = nextSync))
                                        val ctl = controlAutoSyncService(
                                            if (enabled) AutoSyncAction.ENABLE else AutoSyncAction.DISABLE,
                                        )
                                        onNotice(
                                            when {
                                                !ctl.ok -> ctl.output.ifBlank { "Failed to update sync daemon" }
                                                enabled -> "Auto-sync enabled"
                                                else -> "Auto-sync disabled"
                                            },
                                            if (ctl.ok) NotificationTone.Ok else NotificationTone.Err,
                                        )
                                    }
                                } finally {
                                    unitInstalled = withContext(Dispatchers.IO) {
                                        isAutoSyncServiceInstalled()
                                    }
                                    daemon = withContext(Dispatchers.IO) { readDaemonStatus() }
                                    installedSyncdVersion = withContext(Dispatchers.IO) {
                                        readInstalledSyncdVersion()
                                    }
                                    systemctlBusy = false
                                }
                            }
                        },
                    )
                    Text(
                        "Enable auto-sync",
                        color = c.text,
                        style = RdType.body.copy(fontWeight = FontWeight.SemiBold),
                    )
                }
                Text(
                    buildAnnotatedString {
                        append("Daemon: ")
                        withStyle(
                            SpanStyle(
                                color = if (daemon?.running == true) c.ok else c.muted,
                            ),
                        ) {
                            append(if (daemon?.running == true) "running" else "stopped")
                        }
                        daemon?.pid?.let { pid ->
                            append(" ")
                            withStyle(SpanStyle(fontFamily = RdType.mono.fontFamily, fontSize = 11.sp)) {
                                append("pid $pid")
                            }
                        }
                        installedSyncdVersion?.let { ver ->
                            append(" · v$ver")
                        }
                    },
                    color = c.muted,
                    style = RdType.small,
                )
            }

            if (unitInstalled == false) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .border(1.dp, c.line, RectangleShape)
                        .background(c.bg2, RectangleShape)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text("Sync daemon not installed.", color = c.muted, style = RdType.small)
                    RdButton(
                        onClick = {
                            installBusy = true
                            scope.launch {
                                try {
                                    val result = withContext(Dispatchers.IO) { installAutoSyncService() }
                                    unitInstalled = withContext(Dispatchers.IO) {
                                        isAutoSyncServiceInstalled()
                                    }
                                    installedSyncdVersion = withContext(Dispatchers.IO) {
                                        readInstalledSyncdVersion()
                                    }
                                    if (result.ok) {
                                        onNotice("Sync daemon installed", NotificationTone.Ok)
                                    } else {
                                        onNotice(
                                            result.output.ifBlank { "Install failed" },
                                            NotificationTone.Err,
                                        )
                                    }
                                } finally {
                                    installBusy = false
                                }
                            }
                        },
                        enabled = !installBusy && !systemctlBusy,
                    ) {
                        Text(if (installBusy) "Installing…" else "Install")
                    }
                }
            }

            RdField(
                value = sync.deviceName,
                onValueChange = { persistSyncDebounced(sync.copy(deviceName = it)) },
                label = "Device name",
            )

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Sync direction", color = c.muted, style = RdType.small.copy(fontSize = 12.sp))
                RdChoiceRow(
                    options = SyncMode.entries.map { syncModeLabel(it) },
                    selectedIndex = SyncMode.entries.indexOf(sync.mode).coerceAtLeast(0),
                    onSelect = { persistSyncDebounced(sync.copy(mode = SyncMode.entries[it])) },
                )
            }

            RdField(
                value = sync.intervalSeconds.toString(),
                onValueChange = {
                    it.toIntOrNull()?.coerceAtLeast(60)?.let { seconds ->
                        persistSyncDebounced(sync.copy(intervalSeconds = seconds))
                    }
                },
                label = "Interval (seconds)",
            )
            RdField(
                value = sync.debounceSeconds.toString(),
                onValueChange = {
                    it.toIntOrNull()?.coerceAtLeast(5)?.let { seconds ->
                        persistSyncDebounced(sync.copy(debounceSeconds = seconds))
                    }
                },
                label = "Save watch debounce (seconds)",
            )

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Conflict policy", color = c.muted, style = RdType.small.copy(fontSize = 12.sp))
                RdChoiceRow(
                    options = ConflictPolicy.entries.map { conflictLabel(it) },
                    selectedIndex = ConflictPolicy.entries.indexOf(sync.conflictPolicy).coerceAtLeast(0),
                    onSelect = { persistSyncDebounced(sync.copy(conflictPolicy = ConflictPolicy.entries[it])) },
                )
                Text(
                    "Used when local and server copies both changed. Applies to manual Sync Now and the background daemon.",
                    color = c.muted,
                    style = RdType.small,
                )
            }

            Column(
                Modifier
                    .fillMaxWidth()
                    .border(1.dp, c.line, RectangleShape)
                    .background(c.bg2.copy(alpha = 0.4f), RectangleShape),
            ) {
                val advancedInteraction = remember { MutableInteractionSource() }
                val advancedHovered by advancedInteraction.collectIsHoveredAsState()
                val chevronRotation by animateFloatAsState(if (advancedExpanded) 180f else 0f)
                Row(
                    Modifier
                        .fillMaxWidth()
                        .hoverable(advancedInteraction)
                        .clickable(advancedInteraction, null) { advancedExpanded = !advancedExpanded }
                        .pointerHoverIcon(PointerIcon.Hand)
                        .background(
                            if (advancedHovered) c.bg3.copy(alpha = 0.55f) else Color.Transparent,
                            RectangleShape,
                        )
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text("Advanced", color = c.text, style = RdType.body.copy(fontWeight = FontWeight.SemiBold))
                    Icon(
                        Icons.Filled.ExpandMore,
                        contentDescription = if (advancedExpanded) "Collapse advanced options" else "Expand advanced options",
                        modifier = Modifier
                            .size(20.dp)
                            .rotate(chevronRotation),
                        tint = if (advancedHovered) c.text else c.muted,
                    )
                }
                if (advancedExpanded) {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(start = 12.dp, end = 12.dp, bottom = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        SyncCheckOption(
                            checked = sync.registerNewDevice,
                            title = "Register as new device on next sync",
                            description = "One-shot. RomM dedupes by hostname — use this to simulate another machine.",
                            onCheckedChange = {
                                persistSyncImmediate(sync.copy(registerNewDevice = it))
                            },
                        )
                        SyncCheckOption(
                            checked = sync.resetSyncHistory,
                            title = "Reset sync history on next registration",
                            description = "One-shot. Re-download server saves after deleting local files.",
                            onCheckedChange = {
                                persistSyncImmediate(sync.copy(resetSyncHistory = it))
                            },
                        )
                    }
                }
            }

            Text(
                buildAnnotatedString {
                    append("Device ID: ")
                    withStyle(SpanStyle(color = c.accent, fontFamily = RdType.mono.fontFamily, fontSize = 12.sp)) {
                        append(sync.deviceId ?: "not registered")
                    }
                },
                color = c.muted,
                style = RdType.small,
            )
        }
    }
}

@Composable
private fun SyncCheckOption(
    checked: Boolean,
    title: String,
    description: String,
    onCheckedChange: (Boolean) -> Unit,
) {
    val c = Rd
    Row(
        Modifier
            .fillMaxWidth()
            .clickable { onCheckedChange(!checked) },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(
            if (checked) Icons.Filled.CheckBox else Icons.Outlined.CheckBoxOutlineBlank,
            contentDescription = null,
            modifier = Modifier
                .padding(top = 2.dp)
                .size(18.dp),
            tint = if (checked) c.accent else c.muted,
        )
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, color = c.text, style = RdType.body)
            Text(description, color = c.muted, style = RdType.small)
        }
    }
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
