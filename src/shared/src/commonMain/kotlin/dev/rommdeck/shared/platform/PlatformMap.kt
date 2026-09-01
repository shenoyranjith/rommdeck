package dev.rommdeck.shared.platform

import dev.rommdeck.shared.io.readClasspathResource
import kotlinx.serialization.json.Json

private val json = Json { ignoreUnknownKeys = true }

private val bundledMap: Map<String, String> by lazy {
    val text = readClasspathResource("platform-map.json") ?: return@lazy emptyMap()
    json.decodeFromString<Map<String, String>>(text)
}

fun rommSlugToEsdeFolder(
    rommSlug: String,
    overrides: Map<String, String> = emptyMap(),
): String = overrides[rommSlug] ?: bundledMap[rommSlug] ?: rommSlug

fun downloadTargetPath(
    romsPath: String,
    rommSlug: String,
    filename: String,
    overrides: Map<String, String> = emptyMap(),
): String {
    val folder = rommSlugToEsdeFolder(rommSlug, overrides)
    return dev.rommdeck.shared.io.joinPath(romsPath, folder, filename)
}

fun bundledPlatformMap(): Map<String, String> = bundledMap
