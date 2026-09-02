package dev.rommdeck.shared.esde

import kotlin.coroutines.coroutineContext
import kotlinx.coroutines.ensureActive
import dev.rommdeck.shared.log.log
import dev.rommdeck.shared.platform.rommSlugToEsdeFolder
import dev.rommdeck.shared.romm.RommClient
import dev.rommdeck.shared.romm.RommRom
import dev.rommdeck.shared.io.readUtf8File
import dev.rommdeck.shared.io.writeUtf8File

data class RemoveEsdeMetadataResult(
    val gamelistRemoved: Boolean,
    val mediaRemoved: List<String>,
)

fun romHasEsdeMetadata(
    esdeHomePath: String,
    downloadedMediaPath: String,
    rommSlug: String,
    primaryFilename: String,
    platformMapOverrides: Map<String, String> = emptyMap(),
): Boolean {
    if (esdeHomePath.isBlank() || primaryFilename.isBlank()) return false
    val esdeFolder = rommSlugToEsdeFolder(rommSlug, platformMapOverrides)
    val layout = resolveEsdeLayout(esdeHomePath, downloadedMediaPath)
    val gamelistPath = gamelistFilePath(layout.gamelistsRoot, esdeFolder)
    val content = readUtf8File(gamelistPath) ?: return false
    return hasGamelistEntry(content, primaryFilename)
}

suspend fun syncEsdeMetadata(
    client: RommClient,
    romId: Int,
    rommSlug: String,
    primaryFilename: String,
    esdeHomePath: String,
    downloadedMediaPath: String,
    platformMapOverrides: Map<String, String>,
    baseUrl: String,
    cachedRom: RommRom? = null,
) {
    if (esdeHomePath.isBlank()) {
        log.info("esde", "syncEsdeMetadata skipped: empty esdeHomePath", mapOf("romId" to romId))
        return
    }

    val esdeFolder = rommSlugToEsdeFolder(rommSlug, platformMapOverrides)
    val layout = resolveEsdeLayout(esdeHomePath, downloadedMediaPath)
    val gamelistPath = gamelistFilePath(layout.gamelistsRoot, esdeFolder)

    log.info(
        "esde",
        "syncEsdeMetadata start",
        mapOf(
            "romId" to romId,
            "rommSlug" to rommSlug,
            "esdeFolder" to esdeFolder,
            "gamelistPath" to gamelistPath,
        ),
    )

    coroutineContext.ensureActive()
    val rom = cachedRom?.takeIf { it.id == romId } ?: client.getRom(romId)
    coroutineContext.ensureActive()
    val media = downloadRomMedia(
        client = client,
        mediaRoot = layout.mediaRoot,
        esdeFolder = esdeFolder,
        romFilename = primaryFilename,
        rom = rom,
        baseUrl = baseUrl,
    )
    coroutineContext.ensureActive()
    val entry = buildGamelistEntry(rom, primaryFilename)
    GamelistWriteQueue.run(gamelistPath) {
        upsertGamelistGameToDisk(gamelistPath, entry)
    }
    log.info(
        "esde",
        "syncEsdeMetadata complete",
        mapOf("romId" to romId, "romName" to rom.name, "mediaFiles" to media.size),
    )
}

suspend fun removeEsdeMetadata(
    esdeHomePath: String,
    downloadedMediaPath: String,
    esdeFolder: String,
    primaryFilename: String,
): RemoveEsdeMetadataResult {
    val layout = resolveEsdeLayout(esdeHomePath, downloadedMediaPath)
    val gamelistPath = gamelistFilePath(layout.gamelistsRoot, esdeFolder)
    coroutineContext.ensureActive()
    val mediaRemoved = removeRomMedia(layout.mediaRoot, esdeFolder, primaryFilename)
    val gamelistRemoved = GamelistWriteQueue.run(gamelistPath) {
        removeGamelistGameFromDisk(gamelistPath, primaryFilename)
    }
    log.info(
        "esde",
        "removeEsdeMetadata",
        mapOf(
            "esdeFolder" to esdeFolder,
            "primaryFilename" to primaryFilename,
            "gamelistRemoved" to gamelistRemoved,
            "mediaRemoved" to mediaRemoved.size,
        ),
    )
    return RemoveEsdeMetadataResult(gamelistRemoved, mediaRemoved)
}

private fun upsertGamelistGameToDisk(filePath: String, game: GamelistGame) {
    val existing = readUtf8File(filePath).orEmpty()
    ensureParentDir(filePath)
    writeUtf8File(filePath, upsertGamelistGames(existing, game))
}

private fun removeGamelistGameFromDisk(filePath: String, romFilename: String): Boolean {
    val existing = readUtf8File(filePath) ?: return false
    val updated = removeGamelistGame(existing, gamelistPathForRom(romFilename)) ?: return false
    writeUtf8File(filePath, updated)
    return true
}
