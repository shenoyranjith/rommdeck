package dev.rommdeck.shared.sync

import dev.rommdeck.shared.db.IndexedRomFile
import dev.rommdeck.shared.db.LibraryIndex
import dev.rommdeck.shared.db.createInMemoryLibrarySqlDriver
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class NegotiatePayloadTest {
    @Test
    fun hashesExistingFilesWithMd5() {
        val root = Files.createTempDirectory("rommdeck-sync-test")
        val index = LibraryIndex(createInMemoryLibrarySqlDriver(), dbPath = "(memory)")
        try {
            val savesDir = root.resolve("saves").resolve("snes")
            Files.createDirectories(savesDir)
            Files.writeString(savesDir.resolve("Demo (USA).srm"), "save-bytes")

            index.upsertFile(
                IndexedRomFile(
                    romId = 99,
                    rommSlug = "snes",
                    esdeFolder = "snes",
                    filename = "Demo (USA).sfc",
                    size = 1,
                    path = root.resolve("roms").resolve("snes").resolve("Demo (USA).sfc").toString(),
                    downloadedAt = "2026-08-31T00:00:00Z",
                ),
            )

            val payload = buildNegotiatePayload(
                index,
                SyncPaths(
                    romsPath = root.resolve("roms").toString(),
                    savesPath = root.resolve("saves").toString(),
                    statesPath = root.resolve("states").toString(),
                ),
            )

            assertEquals(1, payload.saves.size)
            assertEquals("Demo (USA).srm", payload.saves[0].fileName)
            assertEquals("default", payload.saves[0].slot)
            assertEquals("retroarch", payload.saves[0].emulator)
            assertEquals(99, payload.saves[0].romId)
            assertTrue(payload.saves[0].contentHash.matches(Regex("^[a-f0-9]{32}$")))
            assertEquals(1, payload.discovery.indexedRomFiles)
            assertEquals(1, payload.discovery.retroArchRomFiles)
            assertEquals(1, payload.discovery.existingSaveFiles)
        } finally {
            index.close()
            root.toFile().deleteRecursively()
        }
    }
}
