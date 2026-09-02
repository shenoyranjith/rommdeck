package dev.rommdeck.shared.download

import dev.rommdeck.shared.romm.RommRom

data class ExpectedRomHashes(
    val sha1: String? = null,
    val md5: String? = null,
)

fun expectedHashesForFile(rom: RommRom, filename: String): ExpectedRomHashes {
    val file = rom.files?.find { it.fileName == filename }
    return ExpectedRomHashes(
        sha1 = file?.sha1Hash ?: rom.sha1Hash,
        md5 = file?.md5Hash ?: rom.md5Hash,
    )
}

fun romHasExpectedHash(rom: RommRom, filename: String): Boolean {
    val expected = expectedHashesForFile(rom, filename)
    return !expected.sha1.isNullOrBlank() || !expected.md5.isNullOrBlank()
}
