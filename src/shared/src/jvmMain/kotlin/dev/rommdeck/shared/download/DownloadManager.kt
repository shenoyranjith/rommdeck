package dev.rommdeck.shared.download

import dev.rommdeck.shared.db.IndexedRomFile
import dev.rommdeck.shared.db.LibraryIndex
import dev.rommdeck.shared.esde.removeEsdeMetadata
import dev.rommdeck.shared.esde.syncEsdeMetadata
import dev.rommdeck.shared.log.log
import dev.rommdeck.shared.platform.downloadTargetPath
import dev.rommdeck.shared.platform.rommSlugToEsdeFolder
import dev.rommdeck.shared.romm.RommClient
import dev.rommdeck.shared.romm.RommRom
import dev.rommdeck.shared.romm.contentFilenames
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.attribute.FileTime
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
        downloadRomFiles(rom, onProgress)
        syncRomMetadata(rom, client, client.baseUrl)
    }

    suspend fun downloadRomFiles(
        rom: RommRom,
        onProgress: (bytesWritten: Long) -> Unit = {},
    ) {
        val slug = rom.platformSlug ?: error("ROM ${rom.id} has no platform_slug")
        val filenames = rom.contentFilenames()
        if (filenames.isEmpty()) error("ROM ${rom.id} has no files to download")

        val esdeFolder = rommSlugToEsdeFolder(slug, config.platformMapOverrides)
        log.info("download", "starting", mapOf("romId" to rom.id, "files" to filenames.size))

        var received = 0L
        val completedPaths = mutableListOf<String>()
        try {
            for (filename in filenames) {
                val dest = downloadTargetPath(
                    config.romsPath,
                    slug,
                    filename,
                    config.platformMapOverrides,
                )
                deletePathQuietly(Path.of("$dest.part"))
                client.downloadRomContent(rom.id, filename, dest) { fileBytes ->
                    onProgress(received + fileBytes)
                }
                val hashResult = verifyRomFileHash(dest, expectedHashesForFile(rom, filename))
                val file = java.io.File(dest)
                received += if (file.exists()) file.length() else 0L
                onProgress(received)
                completedPaths += dest
                index.upsertFile(
                    IndexedRomFile(
                        romId = rom.id,
                        rommSlug = slug,
                        esdeFolder = esdeFolder,
                        filename = filename,
                        size = if (file.exists()) file.length() else null,
                        sha1 = hashResult.sha1,
                        path = dest,
                        downloadedAt = Instant.now().toString(),
                        verified = hashResult.verified,
                    ),
                )
                log.info(
                    "download",
                    "file verified",
                    mapOf(
                        "romId" to rom.id,
                        "filename" to filename,
                        "verified" to hashResult.verified,
                    ),
                )
            }
        } catch (e: Exception) {
            rollbackWrittenFiles(completedPaths)
            throw e
        }

        log.info("download", "files complete", mapOf("romId" to rom.id))
    }

    suspend fun syncRomMetadata(
        rom: RommRom,
        client: RommClient,
        baseUrl: String,
    ) {
        if (!config.syncMetadataOnDownload || config.esdeHomePath.isBlank()) return

        val slug = rom.platformSlug ?: return
        val filenames = rom.contentFilenames()
        if (filenames.isEmpty()) return

        syncEsdeMetadata(
            client = client,
            romId = rom.id,
            rommSlug = slug,
            primaryFilename = filenames.first(),
            esdeHomePath = config.esdeHomePath,
            downloadedMediaPath = config.downloadedMediaPath,
            platformMapOverrides = config.platformMapOverrides,
            baseUrl = baseUrl,
            cachedRom = rom,
        )
    }
}

/** Remove in-progress `.part` files for a ROM (e.g. after cancel). */
fun cleanupPartialDownloadFiles(
    rom: RommRom,
    romsPath: String,
    platformMapOverrides: Map<String, String> = emptyMap(),
) {
    val slug = rom.platformSlug ?: return
    for (filename in rom.contentFilenames()) {
        val dest = downloadTargetPath(romsPath, slug, filename, platformMapOverrides)
        deletePathQuietly(Path.of("$dest.part"))
    }
}

private fun deletePathQuietly(path: Path) {
    if (!Files.exists(path)) return
    try {
        Files.delete(path)
    } catch (_: IOException) {
    }
}

private fun rollbackWrittenFiles(paths: List<String>) {
    for (dest in paths) {
        deletePathQuietly(Path.of(dest))
        deletePathQuietly(Path.of("$dest.part"))
    }
}

data class DeleteEsdeOptions(
    val esdeHomePath: String,
    val downloadedMediaPath: String = "",
)

data class DeleteLocalResult(
    val filesRemoved: Int,
    val filesMissing: Int,
    val filesFailed: List<String>,
    val esdeCleaned: Int = 0,
) {
    val fullyRemoved: Boolean get() = filesFailed.isEmpty()
}

suspend fun deleteLocalRom(
    index: LibraryIndex,
    romId: Int,
    esde: DeleteEsdeOptions? = null,
): DeleteLocalResult {
    val rows = index.getByRomId(romId)
    if (rows.isEmpty()) {
        return DeleteLocalResult(filesRemoved = 0, filesMissing = 0, filesFailed = emptyList())
    }

    var removed = 0
    var missing = 0
    val failed = mutableListOf<String>()
    val touchedDirs = mutableSetOf<Path>()

    for (row in rows) {
        val path = Path.of(row.path)
        path.parent?.let { touchedDirs.add(it) }

        if (!Files.exists(path)) {
            missing++
            index.deleteByPath(row.path)
            continue
        }
        if (deletePathWithRetry(path) && deletePathWithRetry(Path.of("${row.path}.part"))) {
            removed++
            index.deleteByPath(row.path)
        } else {
            failed += row.path
        }
    }

    touchedDirs.forEach(::notifyDirectoryChanged)

    var esdeCleaned = 0
    if (esde != null && esde.esdeHomePath.isNotBlank() && failed.isEmpty()) {
        val byFolder = linkedMapOf<String, String>()
        for (row in rows) {
            if (row.esdeFolder !in byFolder) {
                byFolder[row.esdeFolder] = row.filename
            }
        }
        for ((esdeFolder, primaryFilename) in byFolder) {
            val result = removeEsdeMetadata(
                esdeHomePath = esde.esdeHomePath,
                downloadedMediaPath = esde.downloadedMediaPath,
                esdeFolder = esdeFolder,
                primaryFilename = primaryFilename,
            )
            if (result.gamelistRemoved) esdeCleaned++
            esdeCleaned += result.mediaRemoved.size
        }
    }

    log.info(
        "download",
        "deleted local",
        mapOf(
            "romId" to romId,
            "removed" to removed,
            "missing" to missing,
            "failed" to failed.size,
            "esdeCleaned" to esdeCleaned,
        ),
    )
    return DeleteLocalResult(
        filesRemoved = removed,
        filesMissing = missing,
        filesFailed = failed,
        esdeCleaned = esdeCleaned,
    )
}

private fun deletePathWithRetry(path: Path, attempts: Int = 5): Boolean {
    if (!Files.exists(path)) return true
    repeat(attempts) { attempt ->
        try {
            Files.delete(path)
            return true
        } catch (e: IOException) {
            if (attempt == attempts - 1) {
                log.warn(
                    "download",
                    "failed to delete file",
                    mapOf("path" to path.toString(), "error" to (e.message ?: e.toString())),
                )
                return false
            }
            Thread.sleep(50L * (attempt + 1))
        }
    }
    return false
}

private fun notifyDirectoryChanged(dir: Path) {
    try {
        if (Files.isDirectory(dir)) {
            Files.setLastModifiedTime(dir, FileTime.from(Instant.now()))
        }
    } catch (_: IOException) {
    }
}
