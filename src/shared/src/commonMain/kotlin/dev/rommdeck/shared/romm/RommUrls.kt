package dev.rommdeck.shared.romm

internal const val ROMM_RESOURCES_PREFIX = "/assets/romm/resources"

internal fun trimTrailingSlashes(url: String): String = url.trimEnd('/')

internal fun joinBaseUrl(baseUrl: String, path: String): String {
    if (Regex("^https?://", RegexOption.IGNORE_CASE).containsMatchIn(path)) return path
    val base = trimTrailingSlashes(baseUrl)
    return if (path.startsWith("/")) "$base$path" else "$base/$path"
}

internal fun toResourcePath(assetPath: String): String {
    val trimmed = assetPath.trim()
    if (Regex("^https?://", RegexOption.IGNORE_CASE).containsMatchIn(trimmed)) return trimmed
    if (trimmed.startsWith("/assets/romm/") || trimmed.startsWith("/assets/")) return trimmed
    val relative = trimmed.trimStart('/')
    return "$ROMM_RESOURCES_PREFIX/$relative"
}

internal fun normalizeUrl(baseUrl: String, input: String): String {
    val trimmed = input.trim()
    require(trimmed.isNotEmpty()) { "Invalid URL" }
    val absolute = if (Regex("^https?://", RegexOption.IGNORE_CASE).containsMatchIn(trimmed)) {
        trimmed
    } else {
        joinBaseUrl(baseUrl, trimmed)
    }
    return absolute.replace(" ", "%20")
}

internal fun buildUrl(
    baseUrl: String,
    path: String,
    query: Map<String, String?> = emptyMap(),
): String {
    val href = if (path.startsWith("http")) {
        normalizeUrl(baseUrl, path)
    } else {
        normalizeUrl(baseUrl, joinBaseUrl(baseUrl, path))
    }
    if (query.isEmpty()) return href
    val params = query.filterValues { !it.isNullOrBlank() }
    if (params.isEmpty()) return href
    val queryString = params.entries.joinToString("&") { (key, value) ->
        "${encodeQuery(key)}=${encodeQuery(value!!)}"
    }
    return "$href?$queryString"
}

private fun encodeQuery(value: String): String =
    value.replace(" ", "%20")

/** RomM bundled platform icon (`/assets/platforms/{slug}.ico`), not IGDB metadata logos. */
fun platformIconUrl(baseUrl: String, platform: RommPlatform): String? {
    val slug = platform.fsSlug?.takeIf { it.isNotBlank() } ?: platform.slug
    if (slug.isBlank() || baseUrl.isBlank()) return null
    return joinBaseUrl(trimTrailingSlashes(baseUrl), "/assets/platforms/$slug.ico")
}

fun resolveRommAssetUrl(baseUrl: String, assetPath: String?): String? {
    if (assetPath.isNullOrBlank() || baseUrl.isBlank()) return null
    return try {
        normalizeUrl(baseUrl, toResourcePath(assetPath))
    } catch (_: Exception) {
        null
    }
}

fun assetUrlFor(baseUrl: String, assetPath: String?): String? =
    resolveRommAssetUrl(baseUrl, assetPath)

fun coverUrlFor(baseUrl: String, rom: RommRom, preferLarge: Boolean = false): String? {
    if (preferLarge) {
        return resolveRommAssetUrl(baseUrl, rom.pathCoverLarge)
            ?: resolveRommAssetUrl(baseUrl, rom.pathCoverSmall)
            ?: resolveRommAssetUrl(baseUrl, rom.urlCover)
    }
    return resolveRommAssetUrl(baseUrl, rom.pathCoverSmall)
        ?: resolveRommAssetUrl(baseUrl, rom.pathCoverLarge)
        ?: resolveRommAssetUrl(baseUrl, rom.urlCover)
}
