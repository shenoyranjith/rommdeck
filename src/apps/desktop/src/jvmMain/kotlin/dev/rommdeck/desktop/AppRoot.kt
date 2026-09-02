package dev.rommdeck.desktop

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.ApplicationScope
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.rememberWindowState
import dev.rommdeck.shared.config.RommDeckConfig
import dev.rommdeck.shared.config.createConfigRepository
import dev.rommdeck.shared.db.LibraryStats
import dev.rommdeck.shared.play.resolvePlayPaths
import dev.rommdeck.shared.romm.createRommClient
import dev.rommdeck.shared.sync.readDaemonStatus
import java.awt.Toolkit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val ShellInset = 20.dp
private val NotificationBorderWidth = 1.5.dp
private const val BASE_WIDTH = 1280f
private const val BASE_HEIGHT = 800f

enum class NotificationTone { Ok, Err }

private data class AppNotice(val message: String, val tone: NotificationTone)

interface OnNotice {
    operator fun invoke(message: String, tone: NotificationTone = NotificationTone.Ok)
}

@Composable
private fun NotificationBar(
    message: String,
    tone: NotificationTone,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = Rd
    val borderColor = when (tone) {
        NotificationTone.Ok -> c.ok.copy(alpha = 0.4f)
        NotificationTone.Err -> c.danger.copy(alpha = 0.4f)
    }
    val textColor = when (tone) {
        NotificationTone.Ok -> c.ok
        NotificationTone.Err -> c.danger
    }
    Row(
        modifier
            .fillMaxWidth()
            .rdInteractive(onClick = onDismiss, hoverBackground = c.bg3)
            .border(NotificationBorderWidth, borderColor, RectangleShape)
            .background(c.bg2, RectangleShape)
            .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            message,
            modifier = Modifier.fillMaxWidth(),
            color = textColor,
            style = RdType.small,
            textAlign = TextAlign.Start,
        )
    }
}

@Composable
fun ApplicationScope.RommDeckApplication() {
    val queue = remember { SessionDownloadQueue() }
    val activity = remember { AppActivityState() }
    val confirm = remember { ConfirmController() }
    val appScope = rememberCoroutineScope()
    var showQuitConfirm by remember { mutableStateOf(false) }
    var quitting by remember { mutableStateOf(false) }
    val scale = uiScale()
    val screen = try {
        Toolkit.getDefaultToolkit().screenSize
    } catch (_: Exception) {
        null
    }
    val width = (BASE_WIDTH * scale).coerceAtMost((screen?.width ?: Int.MAX_VALUE).toFloat())
    val height = (BASE_HEIGHT * scale).coerceAtMost((screen?.height ?: Int.MAX_VALUE).toFloat())

    Window(
        onCloseRequest = {
            if (quitting) return@Window
            if (shouldConfirmQuit(queue, activity)) {
                showQuitConfirm = true
            } else {
                appScope.launch {
                    performAppQuit(queue, activity)
                    quitting = true
                    exitApplication()
                }
            }
        },
        title = "RommDeck",
        icon = rememberAppIconPainter(),
        state = rememberWindowState(width = width.dp, height = height.dp),
    ) {
        Box(Modifier.fillMaxSize()) {
            AppRoot(queue = queue, confirm = confirm, activity = activity)
            ConfirmHost(confirm)
            if (showQuitConfirm) {
                RdConfirmDialog(
                    request = ConfirmRequest(
                        title = quitConfirmTitle(queue, activity),
                        message = "RommDeck still has work in progress.",
                        detail = quitConfirmDetail(queue, activity),
                        confirmLabel = "Quit anyway",
                        cancelLabel = "Stay",
                        tone = ConfirmTone.WARNING,
                    ),
                    onConfirm = {
                        showQuitConfirm = false
                        appScope.launch {
                            performAppQuit(queue, activity)
                            quitting = true
                            exitApplication()
                        }
                    },
                    onCancel = { showQuitConfirm = false },
                )
            }
        }
    }
}

@Composable
fun AppRoot(
    queue: SessionDownloadQueue,
    confirm: ConfirmController,
    activity: AppActivityState,
) {
    val repo = remember { createConfigRepository() }
    var config by remember { mutableStateOf(repo.load()) }
    val paths = remember(config.playTarget) { resolvePlayPaths(config.playTarget) }
    val appScope = rememberCoroutineScope()
    var tab by remember { mutableStateOf(NavTab.LIBRARY) }
    var stats by remember { mutableStateOf(loadLibraryStats()) }
    var totalRoms by remember { mutableStateOf(0) }
    var daemon by remember { mutableStateOf(readDaemonStatus()) }
    var notice by remember { mutableStateOf<AppNotice?>(null) }

    fun showNotice(message: String, tone: NotificationTone = NotificationTone.Ok) {
        notice = AppNotice(message, tone)
    }

    val onNotice = object : OnNotice {
        override fun invoke(message: String, tone: NotificationTone) {
            showNotice(message, tone)
        }
    }

    LaunchedEffect(notice) {
        val active = notice ?: return@LaunchedEffect
        delay(if (active.tone == NotificationTone.Err) 5_500 else 3_500)
        if (notice == active) notice = null
    }

    LaunchedEffect(config, paths) {
        queue.restorePersistedQueue(config, paths) {
            stats = loadLibraryStats()
        }
    }

    LaunchedEffect(config.romm.baseUrl, config.romm.apiToken) {
        if (config.romm.baseUrl.isBlank()) {
            totalRoms = 0
            return@LaunchedEffect
        }
        totalRoms = withContext(Dispatchers.IO) {
            val client = createRommClient(config.romm)
            try {
                client.getPlatforms().sumOf { it.romCount ?: 0 }
            } catch (_: Exception) {
                0
            } finally {
                client.close()
            }
        }
    }

    LaunchedEffect(Unit) {
        while (true) {
            daemon = withContext(Dispatchers.IO) { readDaemonStatus() }
            delay(5_000)
        }
    }

    AppTheme(config.ui.theme) {
        val c = Rd
        Box(Modifier.fillMaxSize().background(c.accent)) {
            Surface(
                Modifier.padding(3.dp).fillMaxSize(),
                color = MaterialTheme.colorScheme.background,
            ) {
                Row(Modifier.fillMaxSize()) {
                    SidebarColumn(
                        selected = tab,
                        queue = queue,
                        onSelect = { tab = it },
                    )
                    Column(
                        Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .padding(
                                start = ShellInset,
                                end = ShellInset,
                                bottom = ShellInset,
                            ),
                    ) {
                        Box(Modifier.weight(1f).fillMaxWidth()) {
                            Scaffold(
                                modifier = Modifier.fillMaxSize(),
                                containerColor = MaterialTheme.colorScheme.background,
                            ) { insets ->
                                Box(
                                    Modifier
                                        .padding(insets)
                                        .padding(top = ShellInset)
                                        .fillMaxSize(),
                                ) {
                                    when (tab) {
                                        NavTab.LIBRARY -> LibraryScreen(
                                            config = config,
                                            paths = paths,
                                            queue = queue,
                                            confirm = confirm,
                                            appScope = appScope,
                                            busy = activity.libraryBusy,
                                            busyKind = activity.libraryBusyKind,
                                            onBusyChange = { busy, kind, job ->
                                                activity.updateLibraryBusy(busy, kind, job)
                                            },
                                            onNotice = onNotice,
                                            onStatsChanged = { stats = loadLibraryStats() },
                                        )
                                        NavTab.DOWNLOADS -> DownloadsScreen(
                                            queue = queue,
                                            rommBaseUrl = config.romm.baseUrl,
                                            apiToken = config.romm.apiToken,
                                            onOpenLibrary = { tab = NavTab.LIBRARY },
                                            onStartPump = {
                                                queue.startPump(config, paths) {
                                                    stats = loadLibraryStats()
                                                }
                                            },
                                        )
                                        NavTab.SYNC -> SyncScreen(
                                            config = config,
                                            paths = paths,
                                            onNotice = onNotice,
                                            onConfigReloaded = { config = repo.load() },
                                            onOpenAutoSync = { tab = NavTab.SETTINGS },
                                        )
                                        NavTab.SETTINGS -> SettingsScreen(
                                            config = config,
                                            paths = paths,
                                            onConfigChange = { config = it },
                                            onNotice = onNotice,
                                        )
                                    }
                                }
                            }
                            notice?.let { active ->
                                NotificationBar(
                                    message = active.message,
                                    tone = active.tone,
                                    onDismiss = { notice = null },
                                    modifier = Modifier
                                        .align(Alignment.TopCenter)
                                        .fillMaxWidth()
                                        .padding(top = ShellInset),
                                )
                            }
                        }
                        StatusBar(
                            stats = stats,
                            totalRoms = totalRoms,
                            daemonRunning = daemon.running,
                            lastSyncAt = daemon.lastSyncAt,
                            lastResult = daemon.lastResult,
                        )
                    }
                }
            }
            if (config.ui.scanlines) {
                ScanlineOverlay(config.ui.scanlineStrength, Modifier.fillMaxSize())
            }
        }
    }
}

@Composable
private fun SidebarColumn(
    selected: NavTab,
    queue: SessionDownloadQueue,
    onSelect: (NavTab) -> Unit,
) {
    val c = Rd
    val activeDownloads = queue.activeCount
    Column(
        Modifier
            .width(232.dp)
            .fillMaxHeight()
            .background(c.bg1)
            .border(1.dp, c.accent.copy(alpha = 0.8f), RectangleShape)
            .padding(start = 12.dp, end = 12.dp, top = 20.dp, bottom = ShellInset),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(bottom = 40.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            BrandMarkWithLetters(128.dp, c.accent)
            Text(
                "RommDeck",
                style = RdType.brand,
                color = c.text,
                modifier = Modifier.padding(top = 14.dp),
            )
        }

        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            NavTab.entries.forEach { item ->
                RdNavItem(
                    selected = item == selected,
                    label = item.label,
                    onClick = { onSelect(item) },
                    badgeCount = if (item == NavTab.DOWNLOADS) activeDownloads else null,
                    leading = {
                        Icon(
                            item.icon,
                            contentDescription = null,
                            modifier = Modifier.size(32.dp),
                            tint = if (item == selected) c.accent else c.text,
                        )
                    },
                )
            }
        }

        SidebarFooter()
    }
}

@Composable
private fun SidebarFooter() {
    val c = Rd
    Surface(
        Modifier.fillMaxWidth().padding(top = 16.dp),
        color = c.bg0,
        border = BorderStroke(1.dp, c.accent),
        shape = RectangleShape,
    ) {
        Column(
            Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                "RommDeck v${AppInfo.version}",
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                color = c.text,
            )
            Text(
                "RomM → ES-DE",
                style = MaterialTheme.typography.bodyLarge,
                fontSize = 15.sp,
                color = c.muted,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

private val NavTab.icon: ImageVector
    get() = when (this) {
        NavTab.LIBRARY -> Icons.Filled.SportsEsports
        NavTab.DOWNLOADS -> Icons.Filled.Download
        NavTab.SYNC -> Icons.Filled.Sync
        NavTab.SETTINGS -> Icons.Filled.Settings
    }

@Composable
private fun StatusBar(
    stats: LibraryStats,
    totalRoms: Int,
    daemonRunning: Boolean,
    lastSyncAt: String?,
    lastResult: String?,
) {
    val c = Rd
    val missing = (totalRoms - stats.downloadedRoms).coerceAtLeast(0)
    val scanLabel = when {
        daemonRunning -> "Running"
        lastResult == "ok" -> "Complete"
        lastResult == "error" -> "Error"
        lastResult == "partial" -> "Partial"
        else -> "Idle"
    }
    val cells = listOf(
        Triple(Icons.Filled.SportsEsports, "Total ROMs", formatCount(totalRoms)),
        Triple(Icons.Filled.CheckCircle, "Downloaded", formatWithPct(stats.downloadedRoms, totalRoms)),
        Triple(Icons.Filled.Warning, "Missing", formatWithPct(missing, totalRoms)),
        Triple(Icons.Filled.Storage, "Storage Used", formatBytes(stats.storageBytes)),
        Triple(Icons.Filled.Schedule, "Last Scan", formatWhen(lastSyncAt)),
        Triple(Icons.Filled.Sync, "Scan Status", scanLabel),
    )
    Surface(
        Modifier.fillMaxWidth().padding(top = ShellInset),
        color = c.bg0,
        border = BorderStroke(1.dp, c.accent),
        shape = RectangleShape,
    ) {
        Row(
            // Bounds the row to its content so the divider's fillMaxHeight has a
            // finite height to resolve against.
            Modifier.height(IntrinsicSize.Min),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            cells.forEachIndexed { index, (icon, label, value) ->
                if (index > 0) {
                    VerticalDivider(
                        Modifier.padding(horizontal = 8.dp).fillMaxHeight(0.5f),
                        color = c.accent,
                    )
                }
                Row(
                    Modifier.weight(1f).padding(horizontal = 10.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(icon, contentDescription = null, tint = c.accent)
                    Column(Modifier.padding(start = 8.dp).weight(1f)) {
                        Text(
                            label,
                            style = MaterialTheme.typography.bodySmall,
                            color = c.text,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            value,
                            style = RdType.mono.copy(fontSize = 11.sp),
                            color = c.accent,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }
    }
}
