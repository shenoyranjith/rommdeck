package dev.rommdeck.shared.esde

import dev.rommdeck.shared.io.formatUtcYmdT000000
import dev.rommdeck.shared.romm.RommMetadatum
import dev.rommdeck.shared.romm.RommRom

fun buildGamelistEntry(rom: RommRom, primaryFilename: String): GamelistGame {
    val meta = pickMetadatum(rom)
    val releaseTs = meta?.firstReleaseDate ?: rom.generatedFirstReleaseDate
    return GamelistGame(
        path = gamelistPathForRom(primaryFilename),
        name = rom.name.trim().ifEmpty { null },
        desc = rom.summary?.trim()?.ifEmpty { null },
        developer = meta?.developers?.firstOrNull() ?: meta?.companies?.firstOrNull(),
        publisher = meta?.publishers?.firstOrNull() ?: meta?.companies?.getOrNull(1),
        genre = meta?.genres?.filter { it.isNotBlank() }?.joinToString(" / ")?.ifEmpty { null },
        players = rom.generatedPlayerCount
            ?: meta?.gameModes?.filter { it.isNotBlank() }?.joinToString(" / ")?.ifEmpty { null },
        releasedate = releaseTs?.takeIf { it != 0L }?.let { formatEsdeReleaseDate(it) },
    )
}

internal fun formatEsdeReleaseDate(ts: Long): String {
    val ms = if (ts > 1_000_000_000_000L) ts else ts * 1000
    return formatUtcYmdT000000(ms)
}

private fun pickMetadatum(rom: RommRom): RommMetadatum? =
    rom.metadatum ?: rom.igdbMetadata ?: rom.ssMetadata ?: rom.mobyMetadata ?: rom.launchboxMetadata
