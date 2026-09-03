package dev.rommdeck.desktop

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.rommdeck.shared.config.RommConfig
import dev.rommdeck.shared.config.RommDeckConfig
import dev.rommdeck.shared.config.createConfigRepository
import dev.rommdeck.shared.config.saveSyncDaemonConfig
import dev.rommdeck.shared.romm.createRommClient
import java.awt.Desktop
import java.net.URI
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val RommSaveDebounceMs = 400L

private sealed interface RommConnectionStatus {
    data object Idle : RommConnectionStatus
    data object Checking : RommConnectionStatus
    data class Ok(val platforms: Int) : RommConnectionStatus
    data class Error(val message: String) : RommConnectionStatus
}

@Composable
fun RommSettings(
    config: RommDeckConfig,
    onConfigChange: (RommDeckConfig) -> Unit,
    onNotice: OnNotice,
    onPlatformMapEditingChange: (Boolean) -> Unit = {},
) {
    val c = Rd
    val repo = remember { createConfigRepository() }
    val scope = rememberCoroutineScope()
    var saveJob by remember { mutableStateOf<Job?>(null) }
    var connectionStatus by remember { mutableStateOf<RommConnectionStatus>(RommConnectionStatus.Checking) }
    var testing by remember { mutableStateOf(false) }
    var showToken by remember { mutableStateOf(false) }
    var editingPlatformMap by remember { mutableStateOf(false) }
    val overrideCount = config.platformMapOverrides.size
    val canOpenUrl = config.romm.baseUrl.trim().isNotEmpty()

    fun persistRomm(romm: RommConfig) {
        val next = config.copy(romm = romm.copy(baseUrl = romm.baseUrl.trim(), apiToken = romm.apiToken.trim()))
        onConfigChange(next)
        saveJob?.cancel()
        saveJob = scope.launch {
            delay(RommSaveDebounceMs)
            withContext(Dispatchers.IO) { repo.saveSyncDaemonConfig(next) }
        }
    }

    suspend fun checkConnection(): RommConnectionStatus {
        val romm = config.romm
        if (romm.baseUrl.isBlank() || romm.apiToken.isBlank()) {
            return RommConnectionStatus.Idle
        }
        return withContext(Dispatchers.IO) {
            val client = createRommClient(romm.baseUrl.trim(), romm.apiToken.trim())
            try {
                val result = client.testConnection()
                if (result.ok) {
                    RommConnectionStatus.Ok(result.platformCount ?: 0)
                } else {
                    RommConnectionStatus.Error(result.error ?: "Connection failed")
                }
            } catch (e: Exception) {
                RommConnectionStatus.Error(e.message ?: e.toString())
            } finally {
                client.close()
            }
        }
    }

    LaunchedEffect(config.romm.baseUrl, config.romm.apiToken) {
        connectionStatus = RommConnectionStatus.Checking
        connectionStatus = checkConnection()
    }

    LaunchedEffect(editingPlatformMap) {
        onPlatformMapEditingChange(editingPlatformMap)
    }

    if (editingPlatformMap) {
        RdPanel {
            PlatformMapEditor(
                overrides = config.platformMapOverrides,
                onSave = { overrides ->
                    val next = config.copy(platformMapOverrides = overrides)
                    withContext(Dispatchers.IO) { repo.saveSyncDaemonConfig(next) }
                    onConfigChange(next)
                    onNotice("Platform map saved", NotificationTone.Ok)
                    editingPlatformMap = false
                },
                onCancel = { editingPlatformMap = false },
            )
        }
        return
    }

    RdPanel {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            RdField(
                value = config.romm.baseUrl,
                onValueChange = { persistRomm(config.romm.copy(baseUrl = it)) },
                label = "Base URL",
                placeholder = "http://192.168.1.10:8080",
                trailing = {
                    RdFieldSideAction(
                        onClick = { openExternalUrl(config.romm.baseUrl, onNotice) },
                        enabled = canOpenUrl,
                        contentDescription = "Open RomM in browser",
                        icon = Icons.Filled.OpenInNew,
                    )
                },
            )

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                RdField(
                    value = config.romm.apiToken,
                    onValueChange = { persistRomm(config.romm.copy(apiToken = it)) },
                    label = "Client API Token",
                    placeholder = "rmm_…",
                    textStyle = RdType.mono.copy(fontSize = 12.sp, color = c.text),
                    visualTransformation = if (showToken) {
                        VisualTransformation.None
                    } else {
                        PasswordVisualTransformation()
                    },
                    trailing = {
                        RdFieldSideAction(
                            onClick = { showToken = !showToken },
                            contentDescription = if (showToken) "Hide token" else "Show token",
                            icon = if (showToken) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                        )
                    },
                )
                Text(
                    "Create in RomM → Administration → Client API Tokens. Required scopes: platforms and roms read, assets.read, assets.write, devices.read, devices.write.",
                    color = c.muted,
                    style = RdType.small.copy(lineHeight = 18.sp),
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                RdButton(onClick = { editingPlatformMap = true }) {
                    Text("Platform map")
                    if (overrideCount > 0) {
                        Text(
                            " ($overrideCount override${if (overrideCount == 1) "" else "s"})",
                            style = RdType.mono.copy(fontSize = 12.sp, color = c.muted),
                        )
                    }
                }
                Text(
                    "Map RomM platform slugs to library folders (ES-DE system folders) for downloads.",
                    color = c.muted,
                    style = RdType.small,
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RdButton(
                        onClick = {
                            testing = true
                            scope.launch {
                                try {
                                    saveJob?.cancel()
                                    withContext(Dispatchers.IO) { repo.saveSyncDaemonConfig(config) }
                                    connectionStatus = RommConnectionStatus.Checking
                                    val result = checkConnection()
                                    connectionStatus = result
                                    when (result) {
                                        is RommConnectionStatus.Ok ->
                                            onNotice("Connected — ${result.platforms} platforms", NotificationTone.Ok)
                                        is RommConnectionStatus.Error ->
                                            onNotice(result.message, NotificationTone.Err)
                                        else -> Unit
                                    }
                                } catch (e: Exception) {
                                    val message = e.message ?: e.toString()
                                    connectionStatus = RommConnectionStatus.Error(message)
                                    onNotice(message, NotificationTone.Err)
                                } finally {
                                    testing = false
                                }
                            }
                        },
                        enabled = !testing && connectionStatus !is RommConnectionStatus.Checking,
                    ) {
                        Text(if (testing) "Testing…" else "Test connection")
                    }
                    RommConnectionStatusIcon(
                        status = when {
                            testing || connectionStatus is RommConnectionStatus.Checking ->
                                RommConnectionStatus.Checking
                            else -> connectionStatus
                        },
                    )
                }
                val error = connectionStatus as? RommConnectionStatus.Error
                if (error != null && !testing) {
                    Text(error.message, color = c.danger, style = RdType.body)
                }
            }
        }
    }
}

@Composable
private fun RommConnectionStatusIcon(status: RommConnectionStatus) {
    val c = Rd
    when (status) {
        RommConnectionStatus.Idle -> Unit
        RommConnectionStatus.Checking -> {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                strokeWidth = 2.dp,
                color = c.muted,
            )
        }
        is RommConnectionStatus.Ok -> {
            Icon(
                Icons.Filled.CheckCircle,
                contentDescription = "Connected — ${status.platforms} platforms",
                modifier = Modifier.size(20.dp),
                tint = c.ok,
            )
        }
        is RommConnectionStatus.Error -> {
            Icon(
                Icons.Filled.Warning,
                contentDescription = "Connection failed",
                modifier = Modifier.size(20.dp),
                tint = c.danger,
            )
        }
    }
}

private fun openExternalUrl(url: String, onNotice: OnNotice) {
    val trimmed = url.trim()
    if (trimmed.isEmpty()) return
    val normalized = when {
        trimmed.startsWith("http://", ignoreCase = true) ||
            trimmed.startsWith("https://", ignoreCase = true) -> trimmed
        else -> "http://$trimmed"
    }
    try {
        val uri = URI(normalized)
        if (uri.scheme != "http" && uri.scheme != "https") {
            onNotice("Only http and https URLs are allowed", NotificationTone.Err)
            return
        }
        if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
            Desktop.getDesktop().browse(uri)
            return
        }
    } catch (e: Exception) {
        onNotice(e.message ?: "Invalid URL", NotificationTone.Err)
        return
    }
    try {
        ProcessBuilder("xdg-open", normalized).start()
    } catch (e: Exception) {
        onNotice(e.message ?: "Could not open URL", NotificationTone.Err)
    }
}
