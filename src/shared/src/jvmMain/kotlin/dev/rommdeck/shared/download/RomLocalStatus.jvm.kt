package dev.rommdeck.shared.download

import dev.rommdeck.shared.db.IndexedRomFile
import dev.rommdeck.shared.db.LibraryIndex
import dev.rommdeck.shared.esde.romHasEsdeMetadata
import dev.rommdeck.shared.romm.RommRom
import dev.rommdeck.shared.romm.contentFilenames
import java.io.File

enum class RomLocalStatus {
    MISSING,
    VERIFIED,
    UNVERIFIED,
}

data class RomLocalFlags(
    val downloaded: Boolean,
    val verified: Boolean? = null,
    val metadataMissing: Boolean? = null,
)

fun getRomLocalStatus(rom: RommRom, index: LibraryIndex): RomLocalStatus {
    val indexed = index.getByRomId(rom.id)
    if (indexed.isEmpty()) return RomLocalStatus.MISSING

    for (row in indexed) {
        if (!File(row.path).exists()) return RomLocalStatus.MISSING
    }

    val filenames = rom.contentFilenames()
    if (rom.files?.isNotEmpty() == true && filenames.isNotEmpty()) {
        for (name in filenames) {
            if (indexed.none { it.filename == name }) return RomLocalStatus.MISSING
        }
    }

    var anyUnverified = false
    for (row in indexed) {
        if (romHasExpectedHash(rom, row.filename)) {
            if (!hashesMatchRom(rom, row.filename, row.sha1)) {
                return RomLocalStatus.MISSING
            }
        } else {
            anyUnverified = true
        }
    }

    return if (anyUnverified) RomLocalStatus.UNVERIFIED else RomLocalStatus.VERIFIED
}

fun romLocalFlags(
    rom: RommRom,
    index: LibraryIndex,
    esdeHomePath: String,
    downloadedMediaPath: String,
    platformMapOverrides: Map<String, String>,
    syncMetadataOnDownload: Boolean,
): RomLocalFlags {
    val status = getRomLocalStatus(rom, index)
    if (status == RomLocalStatus.MISSING) return RomLocalFlags(downloaded = false)

    val rows = index.getByRomId(rom.id)
    val primary = primaryFilename(rom, rows)
    val slug = rom.platformSlug ?: rows.firstOrNull()?.rommSlug.orEmpty()
    val metadataMissing = if (
        syncMetadataOnDownload &&
        esdeHomePath.isNotBlank() &&
        primary.isNotBlank() &&
        slug.isNotBlank()
    ) {
        !romHasEsdeMetadata(
            esdeHomePath = esdeHomePath,
            downloadedMediaPath = downloadedMediaPath,
            rommSlug = slug,
            primaryFilename = primary,
            platformMapOverrides = platformMapOverrides,
        )
    } else {
        null
    }

    return RomLocalFlags(
        downloaded = true,
        verified = status == RomLocalStatus.VERIFIED,
        metadataMissing = metadataMissing,
    )
}

fun primaryFilename(rom: RommRom, rows: List<IndexedRomFile>): String {
    rows.firstOrNull()?.filename?.let { return it }
    rom.fsName?.takeIf { it.isNotBlank() }?.let { return it }
    return rom.files?.firstOrNull()?.fileName.orEmpty()
}

fun romStatusLabel(flags: RomLocalFlags): String = when {
    !flags.downloaded -> "Missing"
    flags.verified == false -> "Unverified"
    else -> "Downloaded"
}
