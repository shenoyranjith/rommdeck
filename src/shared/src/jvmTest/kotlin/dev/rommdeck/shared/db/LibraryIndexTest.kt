package dev.rommdeck.shared.db

import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class LibraryIndexTest {
    private val index = LibraryIndex(createInMemoryLibrarySqlDriver(), dbPath = "(memory)")

    @AfterTest
    fun close() {
        index.close()
    }

    @Test
    fun upsertThenReadByRomId() {
        index.upsertFile(sample(romId = 10, path = "/roms/snes/game.sfc"))

        val rows = index.getByRomId(10)
        assertEquals(1, rows.size)
        assertEquals("game.sfc", rows[0].filename)
        assertEquals("snes", rows[0].esdeFolder)
        assertTrue(rows[0].verified)
    }

    @Test
    fun upsertSamePathUpdatesRow() {
        index.upsertFile(sample(path = "/roms/snes/game.sfc", size = 100, sha1 = "aaa"))
        index.upsertFile(sample(path = "/roms/snes/game.sfc", size = 200, sha1 = "bbb"))

        val rows = index.getAll()
        assertEquals(1, rows.size)
        assertEquals(200, rows[0].size)
        assertEquals("bbb", rows[0].sha1)
    }

    @Test
    fun statsCountDistinctRoms() {
        index.upsertFile(sample(romId = 1, path = "/a.sfc", size = 10))
        index.upsertFile(sample(romId = 1, path = "/a.srm", size = 2))
        index.upsertFile(sample(romId = 2, path = "/b.sfc", size = 30))

        val stats = index.getStats()
        assertEquals(2, stats.downloadedRoms)
        assertEquals(42, stats.storageBytes)
    }

    @Test
    fun deleteByRomIdReturnsRemovedRows() {
        index.upsertFile(sample(romId = 7, path = "/gone.sfc"))
        val removed = index.deleteByRomId(7)
        assertEquals(1, removed.size)
        assertTrue(index.getByRomId(7).isEmpty())
    }

    private fun sample(
        romId: Int = 1,
        path: String,
        size: Long? = 123,
        sha1: String? = "abc",
    ) = IndexedRomFile(
        romId = romId,
        rommSlug = "snes",
        esdeFolder = "snes",
        filename = path.substringAfterLast('/'),
        size = size,
        sha1 = sha1,
        path = path,
        downloadedAt = "2026-08-31T00:00:00Z",
        verified = true,
    )
}
