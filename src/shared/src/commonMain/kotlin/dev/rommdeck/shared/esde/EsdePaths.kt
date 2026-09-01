package dev.rommdeck.shared.esde

import dev.rommdeck.shared.io.joinPath

data class EsdeLayout(
    val gamelistsRoot: String,
    val mediaRoot: String,
)

/**
 * RetroDECK home is the RD root (`…/retrodeck`) with ES-DE nested under it.
 * Plain ES-DE home is already the ES-DE directory.
 */
fun resolveEsdeLayout(esdeHomePath: String, downloadedMediaPath: String = ""): EsdeLayout {
    val home = esdeHomePath.trimEnd('/', '\\')
    val nested = home.endsWith("ES-DE", ignoreCase = true)
    val esdeRoot = if (nested) home else joinPath(home, "ES-DE")
    val media = downloadedMediaPath.trimEnd('/', '\\').ifBlank {
        joinPath(esdeRoot, "downloaded_media")
    }
    return EsdeLayout(
        gamelistsRoot = joinPath(esdeRoot, "gamelists"),
        mediaRoot = media,
    )
}

fun gamelistFilePath(gamelistsRoot: String, esdeFolder: String): String =
    joinPath(gamelistsRoot, esdeFolder, "gamelist.xml")
