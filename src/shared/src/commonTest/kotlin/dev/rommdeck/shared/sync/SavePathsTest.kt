package dev.rommdeck.shared.sync

import dev.rommdeck.shared.db.IndexedRomFile
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class SavePathsTest {
    @Test
    fun romBasenameKeepsRegionTag() {
        assertEquals("Super Mario World (USA)", romBasename("Super Mario World (USA).sfc"))
    }

    @Test
    fun romBasenameStripsOnlyLastExtension() {
        assertEquals("Game.tar", romBasename("Game.tar.gz"))
    }

    @Test
    fun untagStripsRomMTimestamp() {
        assertEquals(
            "Aladdin (USA).state",
            untagSaveFileName("Aladdin (USA) [2026-04-18_09-45-00].state"),
        )
    }

    @Test
    fun localSaveNameUsesIndexedBasename() {
        assertEquals(
            "Aladdin (USA).state",
            resolveLocalSaveFileName(
                "Aladdin (USA).sfc",
                "Aladdin (USA) [2026-04-18_09-45-00].state",
            ),
        )
    }

    @Test
    fun slotsForBatteryAndStates() {
        assertEquals("default", slotForSaveFileName("mario.srm"))
        assertEquals("state", slotForSaveFileName("mario.state"))
        assertEquals("state0", slotForSaveFileName("mario.state0"))
        assertEquals("state9", slotForSaveFileName("mario.state9"))
    }

    @Test
    fun expectedPathsIncludeSrmAndState3() {
        val paths = resolveExpectedSavePaths(sample(filename = "Aladdin (USA).sfc"), "/saves", "/states")
        assertTrue(paths.any { it.absolutePath.replace('\\', '/') == "/saves/snes/Aladdin (USA).srm" })
        assertTrue(paths.any { it.absolutePath.replace('\\', '/') == "/states/snes/Aladdin (USA).state3" })
    }

    @Test
    fun expectedPathsSkipStandalonePlatforms() {
        val paths = resolveExpectedSavePaths(
            sample(romId = 2, rommSlug = "ngc", esdeFolder = "gc", filename = "Zelda.iso"),
            "/saves",
            "/states",
        )
        assertEquals(emptyList(), paths)
    }

    @Test
    fun expectedPathsDoNotCrossMatchPlatforms() {
        val snes = resolveExpectedSavePaths(
            sample(romId = 10, filename = "Aladdin (USA).sfc"),
            "/saves",
            "/states",
        ).first { it.fileName.endsWith(".srm") }
        val megadrive = resolveExpectedSavePaths(
            sample(
                romId = 11,
                rommSlug = "genesis",
                esdeFolder = "megadrive",
                filename = "Aladdin (USA).md",
            ),
            "/saves",
            "/states",
        ).first { it.fileName.endsWith(".srm") }

        assertNotEquals(snes.absolutePath, megadrive.absolutePath)
        assertEquals("/saves/snes/Aladdin (USA).srm", snes.absolutePath.replace('\\', '/'))
        assertEquals("/saves/megadrive/Aladdin (USA).srm", megadrive.absolutePath.replace('\\', '/'))
    }

    @Test
    fun uniqueIndexedRomFilesDedupesIdenticalRows() {
        val row = sample(filename = "a.sfc")
        assertEquals(1, uniqueIndexedRomFiles(listOf(row, row)).size)
    }

    @Test
    fun resolveLocalSavePathRoutesStates() {
        assertEquals(
            "/states/snes/game.state2",
            resolveLocalSavePath("/saves", "/states", "snes", "game.state2").replace('\\', '/'),
        )
    }

    private fun sample(
        romId: Int = 1,
        rommSlug: String = "snes",
        esdeFolder: String = "snes",
        filename: String,
    ) = IndexedRomFile(
        romId = romId,
        rommSlug = rommSlug,
        esdeFolder = esdeFolder,
        filename = filename,
        path = "/roms/$esdeFolder/$filename",
        downloadedAt = "",
    )
}
