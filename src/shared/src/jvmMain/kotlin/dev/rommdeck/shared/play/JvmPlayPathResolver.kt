package dev.rommdeck.shared.play

import dev.rommdeck.shared.config.PlayTargetConfig
import dev.rommdeck.shared.paths.AppPaths
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.nio.file.Path
import kotlin.io.path.exists
import kotlin.io.path.isDirectory
import kotlin.io.path.readText

@Serializable
internal data class RetroDeckJson(
    val paths: RetroDeckPathsJson? = null,
)

@Serializable
internal data class RetroDeckPathsJson(
    @SerialName("rd_home_path") val rdHomePath: String? = null,
    @SerialName("roms_path") val romsPath: String? = null,
    @SerialName("saves_path") val savesPath: String? = null,
    @SerialName("states_path") val statesPath: String? = null,
    @SerialName("downloaded_media_path") val downloadedMediaPath: String? = null,
)

internal data class EsdeCandidate(
    val homePath: String,
    val romsPath: String,
    val savesPath: String,
    val statesPath: String,
    val downloadedMediaPath: String,
)

private val json = Json { ignoreUnknownKeys = true }

actual fun resolvePlayPaths(playTarget: PlayTargetConfig): ResolvedPlayPaths {
    val hasManual = playTarget.romsPath.isNotBlank() ||
        playTarget.savesPath.isNotBlank() ||
        playTarget.statesPath.isNotBlank()

    if (isLinux()) {
        findRetroDeckJson(playTarget.configPath)?.let { (usedPath, rd) ->
            return buildFromRetroDeck(usedPath, rd, playTarget, PathSource.RETRODECK_AUTO)
        }
    }

    if (hasManual) {
        return buildManual(playTarget)
    }

    if (isLinux()) {
        detectEsdeCandidate()?.let { candidate ->
            return ResolvedPlayPaths(
                romsPath = candidate.romsPath,
                savesPath = candidate.savesPath,
                statesPath = candidate.statesPath,
                downloadedMediaPath = candidate.downloadedMediaPath,
                esdeHomePath = candidate.homePath,
                retrodeckJsonPath = "",
                source = PathSource.ESDE_AUTO,
            )
        }
    }

    detectEsdeCandidate()?.let { candidate ->
        return ResolvedPlayPaths(
            romsPath = candidate.romsPath,
            savesPath = candidate.savesPath,
            statesPath = candidate.statesPath,
            downloadedMediaPath = candidate.downloadedMediaPath,
            esdeHomePath = candidate.homePath,
            retrodeckJsonPath = "",
            source = PathSource.ESDE_AUTO,
        )
    }

    return ResolvedPlayPaths(
        romsPath = "",
        savesPath = "",
        statesPath = "",
        downloadedMediaPath = "",
        esdeHomePath = "",
        retrodeckJsonPath = "",
        source = PathSource.UNCONFIGURED,
    )
}

internal fun readRetroDeckJson(configPath: String): RetroDeckJson? {
    val path = Path.of(expandHome(configPath))
    if (!path.exists()) return null
    return try {
        json.decodeFromString(RetroDeckJson.serializer(), path.readText())
    } catch (_: Exception) {
        null
    }
}

internal fun findRetroDeckJson(configPathOverride: String): Pair<String, RetroDeckJson>? {
    val candidates = buildList {
        if (configPathOverride.isNotBlank()) add(configPathOverride)
        add(AppPaths.defaultRetroDeckJsonPath())
    }
    for (candidate in candidates.distinct()) {
        val parsed = readRetroDeckJson(candidate)
        if (parsed?.paths != null) {
            return expandHome(candidate) to parsed
        }
    }
    return null
}

private fun buildFromRetroDeck(
    usedPath: String,
    rd: RetroDeckJson,
    playTarget: PlayTargetConfig,
    source: PathSource,
): ResolvedPlayPaths {
    val paths = rd.paths ?: return buildManual(playTarget)
    val rdHome = expandHome(paths.rdHomePath.orEmpty())
    val roms = playTarget.romsPath.ifBlank { expandHome(paths.romsPath.orEmpty()) }
    val saves = playTarget.savesPath.ifBlank { expandHome(paths.savesPath.orEmpty()) }
    val states = playTarget.statesPath.ifBlank { expandHome(paths.statesPath.orEmpty()) }
    val media = expandHome(paths.downloadedMediaPath.orEmpty()).ifBlank {
        if (rdHome.isNotBlank()) "$rdHome/ES-DE/downloaded_media" else ""
    }
    val esdeHome = rdHome.ifBlank { inferEsdeHomeFromRoms(roms) }
    val resolvedSource = if (
        playTarget.romsPath.isNotBlank() ||
        playTarget.savesPath.isNotBlank() ||
        playTarget.statesPath.isNotBlank()
    ) {
        PathSource.MANUAL
    } else {
        source
    }
    return ResolvedPlayPaths(
        romsPath = roms,
        savesPath = saves,
        statesPath = states,
        downloadedMediaPath = media,
        esdeHomePath = esdeHome,
        retrodeckJsonPath = usedPath,
        source = resolvedSource,
    )
}

private fun buildManual(playTarget: PlayTargetConfig): ResolvedPlayPaths {
    val roms = playTarget.romsPath
    val saves = playTarget.savesPath
    val states = playTarget.statesPath
    val esdeHome = inferEsdeHomeFromRoms(roms)
    val media = if (esdeHome.isNotBlank()) "$esdeHome/ES-DE/downloaded_media" else ""
    val source = if (roms.isBlank() && saves.isBlank() && states.isBlank()) {
        PathSource.UNCONFIGURED
    } else {
        PathSource.MANUAL
    }
    return ResolvedPlayPaths(
        romsPath = roms,
        savesPath = saves,
        statesPath = states,
        downloadedMediaPath = media,
        esdeHomePath = esdeHome,
        retrodeckJsonPath = "",
        source = source,
    )
}

/** Best-effort ES-DE layout detection when RetroDECK is not installed. */
internal fun detectEsdeCandidate(): EsdeCandidate? {
    val home = System.getenv("HOME") ?: System.getProperty("user.home")
    val userProfile = System.getenv("USERPROFILE") ?: home
    val os = System.getProperty("os.name").lowercase()
    val roots = when {
        os.contains("win") -> listOf(
            "$userProfile\\ES-DE",
            "$userProfile\\Documents\\ES-DE",
        )
        os.contains("mac") -> listOf(
            "$home/Library/Application Support/ES-DE",
        )
        else -> listOf(
            "$home/.local/share/ES-DE",
            "$home/ES-DE",
            "$home/.var/app/org.es_de.frontend/data/ES-DE",
            "$home/.var/app/es-de.ES-DE/data/ES-DE",
        )
    }
    for (root in roots) {
        val path = Path.of(root)
        if (!path.isDirectory()) continue
        val roms = firstExistingSubdir(path, listOf("roms", "ROMs", "Roms"))
        val saves = firstExistingSubdir(path, listOf("saves", "Saves"))
        val states = firstExistingSubdir(path, listOf("states", "States", "savestates"))
        if (roms != null || saves != null) {
            return EsdeCandidate(
                homePath = root,
                romsPath = roms ?: "",
                savesPath = saves ?: "",
                statesPath = states ?: "",
                downloadedMediaPath = "$root/downloaded_media",
            )
        }
    }
    return null
}

private fun firstExistingSubdir(root: Path, names: List<String>): String? {
    for (name in names) {
        val child = root.resolve(name)
        if (child.isDirectory()) return child.toString()
    }
    return null
}

private fun inferEsdeHomeFromRoms(romsPath: String): String {
    if (romsPath.isBlank()) return ""
    val path = Path.of(romsPath)
    val parent = path.parent ?: return ""
    return if (parent.fileName.toString().equals("roms", ignoreCase = true)) {
        parent.parent?.toString().orEmpty()
    } else {
        parent.toString()
    }
}

internal fun expandHome(path: String): String {
    if (path.isBlank()) return path
    val home = System.getenv("HOME") ?: System.getProperty("user.home")
    var expanded = path.replace("\${HOME}", home).replace("\$HOME", home)
    if (expanded.startsWith("~/")) {
        expanded = home + expanded.substring(1)
    }
    return expanded
}

internal fun isLinux(): Boolean {
    val os = System.getProperty("os.name").lowercase()
    return os.contains("linux")
}
