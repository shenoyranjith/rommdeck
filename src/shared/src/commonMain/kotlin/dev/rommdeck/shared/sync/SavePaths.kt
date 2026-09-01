package dev.rommdeck.shared.sync

import dev.rommdeck.shared.db.IndexedRomFile
import dev.rommdeck.shared.io.joinPath
import dev.rommdeck.shared.io.readClasspathResource
import kotlinx.serialization.json.Json

private val json = Json { ignoreUnknownKeys = true }

private val emulatorMap: Map<String, String> by lazy {
    val text = readClasspathResource("platform-emulator-map.json") ?: return@lazy emptyMap()
    json.decodeFromString<Map<String, String>>(text)
}

fun isRetroArchSyncPlatform(esdeFolder: String): Boolean {
    val family = emulatorMap[esdeFolder] ?: return true
    return family == "retroarch"
}

val BATTERY_SAVE_EXTENSIONS = listOf(
    ".srm", ".sav", ".rtc", ".eep", ".fla", ".mcr", ".mcd",
    ".vmp", ".cds", ".bkr", ".bcr", ".smpc",
)

val STATE_FILE_SUFFIXES = listOf(
    ".state", ".state0", ".state1", ".state2", ".state3",
    ".state4", ".state5", ".state6", ".state7", ".state8", ".state9",
)

enum class SaveFileKind { BATTERY, STATE }

data class ExpectedSavePath(
    val romId: Int,
    val esdeFolder: String,
    val absolutePath: String,
    val fileName: String,
    val kind: SaveFileKind,
    val slot: String,
    val emulator: String = "retroarch",
)

fun romBasename(filename: String): String {
    val base = filename.substringAfterLast('/').substringAfterLast('\\')
    val dot = base.lastIndexOf('.')
    if (dot <= 0) return base
    return base.substring(0, dot)
}

private val DATETIME_TAG = Regex(" \\[\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-\\d{2}\\]")

fun untagSaveFileName(fileName: String): String = fileName.replace(DATETIME_TAG, "")

fun saveFileExtension(fileName: String): String {
    val untagged = untagSaveFileName(fileName)
    val dot = untagged.lastIndexOf('.')
    if (dot <= 0) return ""
    return untagged.substring(dot)
}

fun resolveLocalSaveFileName(indexedRomFilename: String, serverFileName: String): String {
    val ext = saveFileExtension(serverFileName)
    if (ext.isEmpty()) return untagSaveFileName(serverFileName)
    return "${romBasename(indexedRomFilename)}$ext"
}

fun slotForSaveFileName(fileName: String): String {
    val lower = fileName.lowercase()
    val match = Regex("\\.state(\\d*)$").find(lower) ?: return "default"
    val suffix = match.groupValues[1]
    return if (suffix.isEmpty()) "state" else "state$suffix"
}

fun isStateFileName(fileName: String): Boolean = Regex("\\.state\\d*$", RegexOption.IGNORE_CASE).containsMatchIn(fileName)

fun resolveExpectedSavePaths(
    row: IndexedRomFile,
    savesPath: String,
    statesPath: String,
): List<ExpectedSavePath> {
    if (!isRetroArchSyncPlatform(row.esdeFolder)) return emptyList()
    val base = romBasename(row.filename)
    val out = mutableListOf<ExpectedSavePath>()
    for (ext in BATTERY_SAVE_EXTENSIONS) {
        val fileName = "$base$ext"
        out += ExpectedSavePath(
            romId = row.romId,
            esdeFolder = row.esdeFolder,
            absolutePath = joinPath(savesPath, row.esdeFolder, fileName),
            fileName = fileName,
            kind = SaveFileKind.BATTERY,
            slot = "default",
        )
    }
    for (suffix in STATE_FILE_SUFFIXES) {
        val fileName = "$base$suffix"
        out += ExpectedSavePath(
            romId = row.romId,
            esdeFolder = row.esdeFolder,
            absolutePath = joinPath(statesPath, row.esdeFolder, fileName),
            fileName = fileName,
            kind = SaveFileKind.STATE,
            slot = slotForSaveFileName(fileName),
        )
    }
    return out
}

fun resolveLocalSavePath(
    savesPath: String,
    statesPath: String,
    esdeFolder: String,
    fileName: String,
): String {
    val root = if (isStateFileName(fileName)) statesPath else savesPath
    return joinPath(root, esdeFolder, fileName)
}

fun uniqueIndexedRomFiles(rows: List<IndexedRomFile>): List<IndexedRomFile> {
    val seen = mutableSetOf<String>()
    val out = mutableListOf<IndexedRomFile>()
    for (row in rows) {
        val key = "${row.romId}\u0000${row.esdeFolder}\u0000${row.filename}"
        if (key in seen) continue
        seen += key
        out += row
    }
    return out
}
