package dev.rommdeck.shared.download

import dev.rommdeck.shared.io.writeUtf8File
import dev.rommdeck.shared.log.log
import dev.rommdeck.shared.paths.AppPaths
import dev.rommdeck.shared.romm.RommRom
import java.io.File
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Serializable
data class PersistedActiveEntry(
    val phase: String,
    val rom: RommRom,
    val totalBytes: Long? = null,
    val progressBytes: Long = 0,
)

@Serializable
data class PersistedFailedEntry(
    val rom: RommRom,
    val error: String? = null,
    val totalBytes: Long? = null,
)

@Serializable
data class PersistedDownloadQueue(
    val version: Int = 1,
    val savedAt: String,
    val active: List<PersistedActiveEntry> = emptyList(),
    val failed: List<PersistedFailedEntry> = emptyList(),
)

private val persistJson = Json {
    ignoreUnknownKeys = true
    encodeDefaults = false
}

fun loadPersistedDownloadQueue(): PersistedDownloadQueue? {
    val path = AppPaths.downloadQueueFile()
    val file = File(path)
    if (!file.isFile) return null
    return try {
        val raw = persistJson.decodeFromString<PersistedDownloadQueue>(file.readText())
        if (raw.version != 1) {
            log.warn("download", "persisted queue ignored: unsupported version", mapOf("version" to raw.version))
            null
        } else {
            raw
        }
    } catch (e: Exception) {
        log.warn(
            "download",
            "persisted queue load failed",
            mapOf("path" to path, "error" to (e.message ?: e.toString())),
        )
        null
    }
}

fun savePersistedDownloadQueue(data: PersistedDownloadQueue) {
    val path = AppPaths.downloadQueueFile()
    val tmp = "$path.tmp"
    writeUtf8File(tmp, persistJson.encodeToString(data))
    File(tmp).renameTo(File(path))
}

fun clearPersistedDownloadQueue() {
    val path = AppPaths.downloadQueueFile()
    try {
        File(path).delete()
    } catch (_: Exception) {
    }
}
