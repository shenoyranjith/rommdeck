package dev.rommdeck.desktop

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.rommdeck.shared.config.LOG_LEVELS
import dev.rommdeck.shared.config.LogLevel
import dev.rommdeck.shared.config.RommDeckConfig
import dev.rommdeck.shared.config.createConfigRepository
import dev.rommdeck.shared.log.configureLogging
import dev.rommdeck.shared.paths.AppPaths
import java.awt.Desktop
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val LoggingSaveDebounceMs = 400L

@Composable
fun LoggingSettings(
    config: RommDeckConfig,
    onConfigChange: (RommDeckConfig) -> Unit,
    onNotice: OnNotice,
) {
    val c = Rd
    val repo = remember { createConfigRepository() }
    val scope = rememberCoroutineScope()
    var saveJob by remember { mutableStateOf<Job?>(null) }
    val logPath = AppPaths.appLogFile()

    fun persistLevel(level: LogLevel) {
        val next = config.copy(logging = config.logging.copy(level = level))
        configureLogging(level)
        onConfigChange(next)
        saveJob?.cancel()
        saveJob = scope.launch {
            delay(LoggingSaveDebounceMs)
            withContext(Dispatchers.IO) { repo.save(next) }
        }
    }

    RdPanel {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(
                "RommDeck writes structured logs for the GUI, downloads, sync, and the background daemon.",
                color = c.muted,
                style = RdType.small,
            )

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Log level", color = c.muted, style = RdType.small.copy(fontSize = 12.sp))
                LOG_LEVELS.forEach { level ->
                    val selected = config.logging.level == level
                    Text(
                        logLevelLabel(level),
                        color = if (selected) c.accent else c.text,
                        style = RdType.body.copy(
                            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .rdInteractive(
                                onClick = { persistLevel(level) },
                                hoverBackground = c.accent.copy(alpha = 0.08f),
                            )
                            .border(1.dp, if (selected) c.accent else c.line, RectangleShape)
                            .background(
                                if (selected) c.accent.copy(alpha = 0.12f) else c.bg2,
                                RectangleShape,
                            )
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                    )
                }
            }

            Column(
                Modifier
                    .fillMaxWidth()
                    .border(1.dp, c.line, RectangleShape)
                    .background(c.bg0.copy(alpha = 0.5f))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("Log file", color = c.muted, style = RdType.micro)
                Text(logPath, color = c.text, style = RdType.mono.copy(fontSize = 12.sp, lineHeight = 18.sp))
                RdButton(
                    onClick = { openLogFile(logPath, onNotice) },
                    enabled = logPath.isNotBlank(),
                ) {
                    Text("Open log file")
                }
            }
        }
    }
}

private fun logLevelLabel(level: LogLevel): String = when (level) {
    LogLevel.DEBUG -> "Debug — verbose (IPC args, sync ops, API)"
    LogLevel.INFO -> "Info — normal operation"
    LogLevel.WARN -> "Warn — recoverable issues"
    LogLevel.ERROR -> "Error — failures only"
}

private fun openLogFile(logPath: String, onNotice: OnNotice) {
    if (logPath.isBlank()) return
    val file = File(logPath)
    file.parentFile?.mkdirs()
    if (!file.exists()) {
        try {
            file.writeText("")
        } catch (e: Exception) {
            onNotice(e.message ?: "Could not create log file", NotificationTone.Err)
            return
        }
    }
    try {
        if (Desktop.isDesktopSupported()) {
            Desktop.getDesktop().open(file)
        } else {
            ProcessBuilder("xdg-open", file.absolutePath).start()
        }
    } catch (e: Exception) {
        try {
            ProcessBuilder("xdg-open", file.absolutePath).start()
        } catch (fallback: Exception) {
            onNotice(fallback.message ?: "Could not open log file", NotificationTone.Err)
        }
    }
}
