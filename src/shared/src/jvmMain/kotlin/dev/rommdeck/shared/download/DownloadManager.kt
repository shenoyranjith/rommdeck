package dev.rommdeck.shared.download

import dev.rommdeck.shared.db.IndexedRomFile
import dev.rommdeck.shared.db.LibraryIndex
import dev.rommdeck.shared.esde.buildGamelistEntry
import dev.rommdeck.shared.esde.gamelistFilePath
import dev.rommdeck.shared.esde.resolveEsdeLayout
import dev.rommdeck.shared.esde.upsertGamelistGame
import dev.rommdeck.shared.log.log
import dev.rommdeck.shared.platform.downloadTargetPath
import dev.rommdeck.shared.platform.rommSlugToEsdeFolder
import dev.rommdeck.shared.romm.RommClient
import dev.rommdeck.shared.romm.RommRom
import dev.rommdeck.shared.romm.contentFilenames
import java.time.Instant

data class DownloadManagerConfig(
    val romsPath: String,
    val esdeHomePath: String,
    val downloadedMediaPath: String = "",
    val platformMapOverrides: Map<String, String> = emptyMap(),
    val syncMetadataOnDownload: Boolean = true,
)

class DownloadManager(
    private val client: RommClient,
    private val index: LibraryIndex,
    private val config: DownloadManagerConfig,
) {
    suspend fun downloadRom(
        rom: RommRom,
        onProgress: (bytesWritten: Long) -> Unit = {},
    ) {
        val slug = rom.platformSlug ?: error("ROM ${rom.id} has no platform_slug")
        val filenames = rom.contentFilenames()
        if (filenames.isEmpty()) error("ROM ${rom.id} has no files to download")

        val esdeFolder = rommSlugToEsdeFolder(slug, config.platformMapOverrides)
        log.info("download", "starting", mapOf("romId" to rom.id, "files" to filenames.size))

        for (filename in filenames) {
            val dest = downloadTargetPath(
                config.romsPath,
                slug,
                filename,
                config.platformMapOverrides,
            )
            client.downloadRomContent(rom.id, filename, dest, onProgress)
            val file = java.io.File(dest)
            index.upsertFile(
                IndexedRomFile(
                    romId = rom.id,
                    rommSlug = slug,
                    esdeFolder = esdeFolder,
                    filename = filename,
                    size = if (file.exists()) file.length() else null,
                    sha1 = null,
                    path = dest,
                    downloadedAt = Instant.now().toString(),
                    verified = true,
                ),
            )
        }

        if (config.syncMetadataOnDownload && config.esdeHomePath.isNotBlank()) {
            val layout = resolveEsdeLayout(config.esdeHomePath, config.downloadedMediaPath)
            val gamelistPath = gamelistFilePath(layout.gamelistsRoot, esdeFolder)
            val entry = buildGamelistEntry(rom, filenames.first())
            upsertGamelistGame(gamelistPath, entry)
            log.info("esde", "gamelist upserted", mapOf("path" to gamelistPath, "rom" to rom.name))
        }

        log.info("download", "complete", mapOf("romId" to rom.id))
    }
}

fun deleteLocalRom(index: LibraryIndex, romId: Int): Int {
    val rows = index.deleteByRomId(romId)
    var removed = 0
    for (row in rows) {
        val file = java.io.File(row.path)
        if (file.isFile && file.delete()) removed++
    }
    log.info("download", "deleted local", mapOf("romId" to romId, "removed" to removed))
    return removed
}
