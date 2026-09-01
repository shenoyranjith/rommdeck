package dev.rommdeck.shared.log

import dev.rommdeck.shared.config.LogLevel
import dev.rommdeck.shared.paths.AppPaths
import java.nio.file.Path
import java.time.Instant
import kotlin.io.path.appendText
import kotlin.io.path.createDirectories
import kotlin.io.path.exists
import kotlin.io.path.fileSize
import kotlin.io.path.moveTo

private val LEVEL_RANK = mapOf(
    LogLevel.DEBUG to 10,
    LogLevel.INFO to 20,
    LogLevel.WARN to 30,
    LogLevel.ERROR to 40,
)

private var minLevel: LogLevel = LogLevel.INFO
private var logsDirReady = false

private const val MAX_LOG_BYTES = 5L * 1024 * 1024
private const val MAX_ARCHIVED_LOGS = 9

actual fun configureLogging(level: LogLevel) {
    minLevel = if (level in dev.rommdeck.shared.config.LOG_LEVELS) level else LogLevel.INFO
}

actual fun getConfiguredLogLevel(): LogLevel = minLevel

private fun shouldLog(level: LogLevel): Boolean =
    (LEVEL_RANK[level] ?: 0) >= (LEVEL_RANK[minLevel] ?: 20)

private fun ensureLogsDir() {
    if (!logsDirReady) {
        Path.of(AppPaths.logsDir()).createDirectories()
        logsDirReady = true
    }
}

private fun archivedLogPath(index: Int): Path =
    Path.of(AppPaths.logsDir(), "rommdeck.log.$index")

private fun rotateIfNeeded(active: Path, incomingBytes: Int) {
    if (!active.exists()) return
    if (active.fileSize() + incomingBytes <= MAX_LOG_BYTES) return

    val oldest = archivedLogPath(MAX_ARCHIVED_LOGS)
    if (oldest.exists()) oldest.toFile().delete()

    for (i in MAX_ARCHIVED_LOGS - 1 downTo 1) {
        val from = archivedLogPath(i)
        if (from.exists()) from.moveTo(archivedLogPath(i + 1), overwrite = true)
    }
    active.moveTo(archivedLogPath(1), overwrite = true)
}

private fun write(level: LogLevel, scope: String, message: String, data: Map<String, Any?>) {
    if (!shouldLog(level)) return
    val payload = if (data.isEmpty()) "" else " ${data.entries.joinToString(prefix = "{", postfix = "}") { (k, v) -> "\"$k\":${jsonValue(v)}" }}"
    val line = "${Instant.now()} ${level.name} [$scope] $message$payload\n"
    val bytes = line.toByteArray(Charsets.UTF_8).size

    if (level == LogLevel.ERROR || level == LogLevel.WARN) {
        System.err.println(line.trimEnd())
    } else if (level == LogLevel.DEBUG && shouldLog(LogLevel.DEBUG)) {
        System.out.println(line.trimEnd())
    }

    try {
        ensureLogsDir()
        val active = Path.of(AppPaths.appLogFile())
        rotateIfNeeded(active, bytes)
        active.appendText(line)
    } catch (_: Exception) {
        // Never crash for logging failures.
    }
}

private fun jsonValue(value: Any?): String = when (value) {
    null -> "null"
    is Number, is Boolean -> value.toString()
    else -> "\"${value.toString().replace("\"", "\\\"")}\""
}

private object JvmLogger : Logger {
    override fun debug(scope: String, message: String, data: Map<String, Any?>) =
        write(LogLevel.DEBUG, scope, message, data)

    override fun info(scope: String, message: String, data: Map<String, Any?>) =
        write(LogLevel.INFO, scope, message, data)

    override fun warn(scope: String, message: String, data: Map<String, Any?>) =
        write(LogLevel.WARN, scope, message, data)

    override fun error(scope: String, message: String, data: Map<String, Any?>) =
        write(LogLevel.ERROR, scope, message, data)
}

actual val log: Logger = JvmLogger
