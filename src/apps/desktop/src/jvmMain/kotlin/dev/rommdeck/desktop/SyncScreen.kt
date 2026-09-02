package dev.rommdeck.desktop

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.rommdeck.shared.config.RommDeckConfig
import dev.rommdeck.shared.play.ResolvedPlayPaths
import dev.rommdeck.shared.sync.SyncDiscoveryStats
import dev.rommdeck.shared.sync.SyncOperationSummary
import dev.rommdeck.shared.sync.SyncResult
import dev.rommdeck.shared.sync.readDaemonStatus
import dev.rommdeck.shared.sync.runConfiguredSync
import dev.rommdeck.shared.sync.summarizeSyncOperations
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun SyncScreen(
    config: RommDeckConfig,
    paths: ResolvedPlayPaths,
    onNotice: OnNotice,
    onConfigReloaded: () -> Unit,
    onOpenAutoSync: () -> Unit,
) {
    val c = Rd
    val scope = rememberCoroutineScope()
    var status by remember { mutableStateOf(readDaemonStatus()) }
    var last by remember { mutableStateOf<SyncResult?>(null) }
    var busy by remember { mutableStateOf(false) }
    val canSync = paths.savesPath.isNotBlank() && paths.statesPath.isNotBlank() &&
        config.romm.baseUrl.isNotBlank() && config.romm.apiToken.isNotBlank()

    LaunchedEffect(Unit) {
        while (true) {
            status = withContext(Dispatchers.IO) { readDaemonStatus() }
            delay(5_000)
        }
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        RdPageHeader(
            title = "Sync",
            description = "RetroDECK saves and states with RomM.",
            actions = {
                RdButton(
                    onClick = {
                        busy = true
                        scope.launch {
                            try {
                                val result = withContext(Dispatchers.IO) { runConfiguredSync(unattended = true) }
                                last = result
                                status = readDaemonStatus()
                                onConfigReloaded()
                                onNotice("Sync finished: ${result.completed} completed, ${result.failed} failed")
                            } catch (e: Exception) {
                                onNotice(e.message ?: e.toString(), NotificationTone.Err)
                            } finally {
                                busy = false
                            }
                        }
                    },
                    primary = true,
                    enabled = canSync && !busy,
                ) {
                    Text(if (busy) "Syncing…" else "Sync Now", fontWeight = FontWeight.SemiBold)
                }
            },
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Auto-sync: ", color = c.muted, style = RdType.small)
            Text(
                "Settings → Auto-sync",
                color = c.accent,
                style = RdType.small.copy(textDecoration = TextDecoration.Underline),
                modifier = Modifier.rdInteractive(onClick = onOpenAutoSync),
            )
        }
        if (!canSync) {
            RdAlert("Need RomM credentials and resolved saves/states paths.", AlertTone.ERR)
        }
        RdPanel(title = "Sync status") {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row {
                    Text("Background daemon: ", color = c.text, style = RdType.body)
                    Text(
                        if (status.running) "running" else "not running",
                        color = if (status.running) c.ok else c.muted,
                        style = RdType.body.copy(fontWeight = FontWeight.Bold),
                    )
                    status.pid?.let {
                        Text("  pid $it", color = c.muted, style = RdType.mono)
                    }
                }
                Row {
                    Text("Last sync: ", color = c.text, style = RdType.body)
                    Text(formatWhen(status.lastSyncAt), color = c.accent, style = RdType.mono)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Last result:", color = c.text, style = RdType.body)
                    val tone = when (status.lastResult) {
                        "ok" -> BadgeTone.OK
                        "partial" -> BadgeTone.WARN
                        "error" -> BadgeTone.ERR
                        else -> BadgeTone.MUTED
                    }
                    RdBadge(status.lastResult ?: "—", tone)
                }
                Row {
                    Text("Last run ops: ", color = c.text, style = RdType.body)
                    Text(
                        "${status.completedOps} ok / ${status.failedOps} failed",
                        color = c.accent,
                        style = RdType.mono,
                    )
                }
                if (status.lastError != null) {
                    RdAlert(status.lastError!!, AlertTone.ERR)
                }
                Text("Status updated ${formatWhen(status.updatedAt)}", color = c.muted, style = RdType.small)
            }
        }
        last?.let { result ->
            RdPanel(title = "Last manual sync") {
                Column(
                    Modifier
                        .heightIn(max = 448.dp)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        "session ${result.sessionId ?: "—"} · completed ${result.completed} · failed ${result.failed}",
                        color = c.accent,
                        style = RdType.mono,
                    )
                    if (result.deviceRegistered || result.deviceUpdated) {
                        Text(
                            if (result.deviceRegistered) {
                                "Device registered with RomM."
                            } else {
                                "Device registration updated (paths or sync mode changed)."
                            },
                            color = c.muted,
                            style = RdType.small,
                        )
                    }
                    if (result.operations.isNotEmpty()) {
                        SyncOperationSummaryGrid(summarizeSyncOperations(result.operations))
                    }
                    result.discovery?.let { SyncDiscoveryPanel(it) }
                    if (result.errors.isNotEmpty()) {
                        SyncErrorsPanel(result.errors)
                    }
                }
            }
        }
    }
}

@Composable
private fun SyncOperationSummaryGrid(summary: SyncOperationSummary) {
    val c = Rd
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf(
            "Upload" to summary.upload,
            "Download" to summary.download,
            "Conflict" to summary.conflict,
            "No-op" to summary.noOp,
            "Total" to summary.total,
        ).forEach { (label, count) ->
            Column(
                Modifier
                    .weight(1f)
                    .border(1.dp, c.accent.copy(alpha = 0.4f), RectangleShape)
                    .background(c.bg2, RectangleShape)
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(label.uppercase(), color = c.muted, style = RdType.micro)
                Text(
                    count.toString(),
                    color = c.accent,
                    style = RdType.mono.copy(fontSize = 18.sp, fontWeight = FontWeight.SemiBold),
                )
            }
        }
    }
}

@Composable
private fun SyncDiscoveryPanel(discovery: SyncDiscoveryStats) {
    val c = Rd
    Column(
        Modifier
            .fillMaxWidth()
            .border(1.dp, c.accent.copy(alpha = 0.4f), RectangleShape)
            .background(c.bg2, RectangleShape)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text("Discovery", color = c.muted, style = RdType.micro)
        Text("Indexed ROM files: ${discovery.indexedRomFiles}", color = c.muted, style = RdType.small)
        Text("RetroArch platforms: ${discovery.retroArchRomFiles}", color = c.muted, style = RdType.small)
        Text("Local saves/states found: ${discovery.existingSaveFiles}", color = c.muted, style = RdType.small)
        if (discovery.skippedStandalonePlatforms.isNotEmpty()) {
            Text(
                "Skipped standalone-default platforms:",
                color = c.muted,
                style = RdType.small,
                modifier = Modifier.padding(top = 4.dp),
            )
            Text(
                discovery.skippedStandalonePlatforms.joinToString(", "),
                color = c.warn,
                style = RdType.mono.copy(fontSize = 11.sp),
            )
        }
    }
}

@Composable
private fun SyncErrorsPanel(errors: List<String>) {
    val c = Rd
    Column(
        Modifier
            .fillMaxWidth()
            .border(1.dp, c.danger.copy(alpha = 0.4f), RectangleShape)
            .background(c.bg2, RectangleShape)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text("Errors", color = c.danger, style = RdType.micro)
        errors.forEach { err ->
            Text("• $err", color = c.muted, style = RdType.small)
        }
    }
}
