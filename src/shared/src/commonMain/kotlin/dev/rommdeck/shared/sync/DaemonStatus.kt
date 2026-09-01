package dev.rommdeck.shared.sync

import dev.rommdeck.shared.io.currentTimeIso
import dev.rommdeck.shared.io.readUtf8File
import dev.rommdeck.shared.io.writeUtf8File
import dev.rommdeck.shared.paths.AppPaths
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class DaemonStatus(
    val running: Boolean = false,
    val pid: Long? = null,
    val lastSyncAt: String? = null,
    val lastResult: String? = null,
    val lastError: String? = null,
    val pendingConflicts: List<String> = emptyList(),
    val completedOps: Int = 0,
    val failedOps: Int = 0,
    val updatedAt: String = "1970-01-01T00:00:00Z",
)

val EMPTY_DAEMON_STATUS = DaemonStatus()

private val daemonStatusJson = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
    prettyPrint = true
}

fun decodeDaemonStatus(text: String): DaemonStatus =
    try {
        daemonStatusJson.decodeFromString(DaemonStatus.serializer(), text)
    } catch (_: Exception) {
        EMPTY_DAEMON_STATUS
    }

fun encodeDaemonStatus(status: DaemonStatus): String =
    daemonStatusJson.encodeToString(DaemonStatus.serializer(), status)

fun readDaemonStatus(): DaemonStatus {
    val text = readUtf8File(AppPaths.daemonStatusFile()) ?: return EMPTY_DAEMON_STATUS
    return decodeDaemonStatus(text)
}

fun persistDaemonStatus(transform: (DaemonStatus) -> DaemonStatus): DaemonStatus {
    val next = transform(readDaemonStatus()).copy(updatedAt = currentTimeIso())
    writeUtf8File(AppPaths.daemonStatusFile(), encodeDaemonStatus(next))
    return next
}
