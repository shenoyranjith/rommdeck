package dev.rommdeck.shared.esde

import dev.rommdeck.shared.log.log
import kotlin.coroutines.coroutineContext
import kotlinx.coroutines.ensureActive
import dev.rommdeck.shared.romm.RommClient
import dev.rommdeck.shared.romm.RommRom
import dev.rommdeck.shared.romm.assetUrlFor
import dev.rommdeck.shared.romm.coverUrlFor
import java.io.File

private val imageExts = setOf(".jpg", ".jpeg", ".png", ".webp")
private val videoExts = setOf(".mp4", ".mkv", ".avi", ".wmv", ".mov", ".webm")

data class DownloadedMedia(val type: String, val path: String)

private fun mediaStem(filename: String): String {
    val file = File(filename)
    val name = file.name
    val dot = name.lastIndexOf('.')
    return if (dot > 0) name.substring(0, dot) else name
}

private fun extensionFromUrl(url: String, fallback: String): String {
    return try {
        val path = java.net.URI(url).path
        val dot = path.lastIndexOf('.')
        if (dot >= 0) {
            val ext = path.substring(dot).lowercase()
            if (ext.isNotEmpty()) return ext
        }
        fallback
    } catch (_: Exception) {
        fallback
    }
}

private fun destPath(dir: String, stem: String, ext: String): String {
    val normalized = if (ext.startsWith(".")) ext else ".$ext"
    return File(dir, "$stem${normalized.lowercase()}").path
}

private suspend fun tryDownloadMedia(
    label: String,
    romId: Int,
    run: suspend () -> DownloadedMedia,
): DownloadedMedia? {
    return try {
        run()
    } catch (e: Exception) {
        log.info(
            "esde",
            "$label download skipped",
            mapOf("romId" to romId, "error" to (e.message ?: e.toString())),
        )
        null
    }
}

suspend fun downloadRomMedia(
    client: RommClient,
    mediaRoot: String,
    esdeFolder: String,
    romFilename: String,
    rom: RommRom,
    baseUrl: String,
): List<DownloadedMedia> {
    val stem = mediaStem(romFilename)
    val saved = mutableListOf<DownloadedMedia>()

    coroutineContext.ensureActive()
    val coverUrl = coverUrlFor(baseUrl, rom, preferLarge = true)
    if (coverUrl != null) {
        val dir = mediaTypeDir(mediaRoot, esdeFolder, "covers")
        ensureParentDir(destPath(dir, stem, ".png"))
        File(dir).mkdirs()
        val ext = extensionFromUrl(coverUrl, ".png")
        val dest = destPath(dir, stem, ext)
        tryDownloadMedia("cover", rom.id) {
            log.info("esde", "downloading cover", mapOf("romId" to rom.id, "dest" to dest))
            client.downloadAsset(coverUrl, dest)
            DownloadedMedia("covers", dest)
        }?.let { saved += it }
    }

    coroutineContext.ensureActive()
    val screenshotPath = rom.mergedScreenshots?.firstOrNull()
    val screenshotUrl = assetUrlFor(baseUrl, screenshotPath)
    if (screenshotUrl != null) {
        val dir = mediaTypeDir(mediaRoot, esdeFolder, "screenshots")
        File(dir).mkdirs()
        val ext = extensionFromUrl(screenshotUrl, ".jpg")
        val dest = destPath(dir, stem, ext)
        tryDownloadMedia("screenshot", rom.id) {
            log.info("esde", "downloading screenshot", mapOf("romId" to rom.id, "dest" to dest))
            client.downloadAsset(screenshotUrl, dest)
            DownloadedMedia("screenshots", dest)
        }?.let { saved += it }
    }

    coroutineContext.ensureActive()
    val videoUrl = assetUrlFor(baseUrl, rom.pathVideo)
    if (videoUrl != null) {
        val dir = mediaTypeDir(mediaRoot, esdeFolder, "videos")
        File(dir).mkdirs()
        val ext = extensionFromUrl(videoUrl, ".mp4")
        val dest = destPath(dir, stem, ext)
        tryDownloadMedia("video", rom.id) {
            log.info("esde", "downloading video", mapOf("romId" to rom.id, "dest" to dest))
            client.downloadAsset(videoUrl, dest)
            DownloadedMedia("videos", dest)
        }?.let { saved += it }
    }

    return saved
}

fun removeRomMedia(mediaRoot: String, esdeFolder: String, romFilename: String): List<String> {
    val stem = mediaStem(romFilename)
    val removed = mutableListOf<String>()
    val types = listOf("covers", "screenshots", "videos", "marquees", "fanart", "titlescreens")
    for (type in types) {
        val dir = File(mediaTypeDir(mediaRoot, esdeFolder, type))
        if (!dir.isDirectory) continue
        for (file in dir.listFiles().orEmpty()) {
            if (!file.isFile) continue
            val name = file.name
            val dot = name.lastIndexOf('.')
            val fileStem = if (dot > 0) name.substring(0, dot) else name
            val ext = if (dot >= 0) name.substring(dot).lowercase() else ""
            if (fileStem != stem) continue
            if (ext !in imageExts && ext !in videoExts) continue
            if (file.delete()) removed += file.path
        }
    }
    return removed
}
