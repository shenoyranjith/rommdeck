package dev.rommdeck.shared.platform

enum class PlatformMapSource {
    Default,
    Override,
    Identity,
}

data class PlatformMapRow(
    val rommSlug: String,
    val esdeFolder: String,
    val source: PlatformMapSource,
)

fun defaultEsdeFolder(rommSlug: String, bundled: Map<String, String>): String =
    bundled[rommSlug] ?: rommSlug

fun rowSource(
    rommSlug: String,
    esdeFolder: String,
    bundled: Map<String, String>,
): PlatformMapSource {
    val fallback = defaultEsdeFolder(rommSlug, bundled)
    if (esdeFolder == fallback) {
        return if (bundled.containsKey(rommSlug)) PlatformMapSource.Default else PlatformMapSource.Identity
    }
    return PlatformMapSource.Override
}

fun buildPlatformMapRows(
    bundled: Map<String, String>,
    overrides: Map<String, String>,
): List<PlatformMapRow> {
    val slugs = (bundled.keys + overrides.keys).toSortedSet()
    return slugs.map { rommSlug ->
        val esdeFolder = overrides[rommSlug] ?: defaultEsdeFolder(rommSlug, bundled)
        PlatformMapRow(
            rommSlug = rommSlug,
            esdeFolder = esdeFolder,
            source = rowSource(rommSlug, esdeFolder, bundled),
        )
    }
}

fun overridesFromRows(
    rows: List<PlatformMapRow>,
    bundled: Map<String, String>,
): Map<String, String> {
    val out = linkedMapOf<String, String>()
    for (row in rows) {
        val fallback = defaultEsdeFolder(row.rommSlug, bundled)
        if (row.esdeFolder != fallback) {
            out[row.rommSlug] = row.esdeFolder
        }
    }
    return out
}

fun platformMapSourceLabel(source: PlatformMapSource): String = when (source) {
    PlatformMapSource.Default -> "Default"
    PlatformMapSource.Override -> "Override"
    PlatformMapSource.Identity -> "Identity"
}
