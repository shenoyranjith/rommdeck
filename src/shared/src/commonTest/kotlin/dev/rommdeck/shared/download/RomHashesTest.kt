package dev.rommdeck.shared.download

import dev.rommdeck.shared.romm.RommRom
import dev.rommdeck.shared.romm.RommRomFile
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RomHashesTest {
    @Test
    fun expectedHashesPreferFileLevelValues() {
        val rom = RommRom(
            id = 1,
            name = "Game",
            sha1Hash = "rom-sha1",
            md5Hash = "rom-md5",
            files = listOf(
                RommRomFile(
                    fileName = "game.sfc",
                    sha1Hash = "file-sha1",
                    md5Hash = "file-md5",
                ),
            ),
        )
        val expected = expectedHashesForFile(rom, "game.sfc")
        assertEquals("file-sha1", expected.sha1)
        assertEquals("file-md5", expected.md5)
    }

    @Test
    fun expectedHashesFallBackToRomLevel() {
        val rom = RommRom(
            id = 1,
            name = "Game",
            fsName = "game.sfc",
            sha1Hash = "rom-sha1",
            md5Hash = null,
        )
        val expected = expectedHashesForFile(rom, "game.sfc")
        assertEquals("rom-sha1", expected.sha1)
        assertEquals(null, expected.md5)
    }

    @Test
    fun romHasExpectedHashDetectsMissingHashes() {
        val withHash = RommRom(id = 1, name = "Game", sha1Hash = "abc")
        val without = RommRom(id = 2, name = "Other")
        assertTrue(romHasExpectedHash(withHash, "game.sfc"))
        assertFalse(romHasExpectedHash(without, "game.sfc"))
    }
}
