package dev.rommdeck.shared.download

import dev.rommdeck.shared.db.IndexedRomFile
import dev.rommdeck.shared.db.LibraryIndex
import dev.rommdeck.shared.db.createInMemoryLibrarySqlDriver
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlinx.coroutines.runBlocking
import java.nio.file.Files

class DeleteLocalRomTest {
    private val index = LibraryIndex(createInMemoryLibrarySqlDriver(), dbPath = "(memory)")
    private val tempDir = Files.createTempDirectory("rommdeck-delete-test")

    @AfterTest
    fun cleanup() {
        index.close()
        tempDir.toFile().deleteRecursively()
    }

    @Test
    fun deletesFileBeforeRemovingIndexRow() {
        val path = tempDir.resolve("game.sfc")
        Files.write(path, byteArrayOf(1, 2, 3))
        index.upsertFile(sample(path = path.toString()))

        val result = runBlocking { deleteLocalRom(index, 10) }

        assertTrue(result.fullyRemoved)
        assertEquals(1, result.filesRemoved)
        assertFalse(Files.exists(path))
        assertTrue(index.getByRomId(10).isEmpty())
    }

    @Test
    fun removesMissingFileFromIndex() {
        val path = tempDir.resolve("gone.sfc").toString()
        index.upsertFile(sample(path = path))

        val result = runBlocking { deleteLocalRom(index, 10) }

        assertTrue(result.fullyRemoved)
        assertEquals(1, result.filesMissing)
        assertTrue(index.getByRomId(10).isEmpty())
    }

    private fun sample(path: String) = IndexedRomFile(
        romId = 10,
        rommSlug = "snes",
        esdeFolder = "snes",
        filename = path.substringAfterLast('/'),
        size = 3,
        sha1 = null,
        path = path,
        downloadedAt = "2026-09-02T00:00:00Z",
        verified = true,
    )
}
