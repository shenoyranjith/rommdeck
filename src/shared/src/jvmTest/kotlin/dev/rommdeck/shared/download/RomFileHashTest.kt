package dev.rommdeck.shared.download

import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RomFileHashTest {
    @Test
    fun verifySha1WhenProvided() {
        val dir = Files.createTempDirectory("rommdeck-hash-test")
        val path = dir.resolve("game.bin")
        Files.writeString(path, "hello")
        val result = verifyRomFileHash(
            path.toString(),
            ExpectedRomHashes(sha1 = "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d"),
        )
        assertTrue(result.verified)
        assertEquals("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d", result.sha1)
    }

    @Test
    fun verifyMd5WhenSha1Missing() {
        val dir = Files.createTempDirectory("rommdeck-hash-test")
        val path = dir.resolve("game.bin")
        Files.writeString(path, "hello")
        val result = verifyRomFileHash(
            path.toString(),
            ExpectedRomHashes(md5 = "5d41402abc4b2a76b9719d911017c592"),
        )
        assertTrue(result.verified)
    }

    @Test
    fun verifyWithoutExpectedHashesStoresSha1Only() {
        val dir = Files.createTempDirectory("rommdeck-hash-test")
        val path = dir.resolve("game.bin")
        Files.writeString(path, "hello")
        val result = verifyRomFileHash(path.toString(), ExpectedRomHashes())
        assertFalse(result.verified)
        assertEquals("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d", result.sha1)
    }

    @Test
    fun verifyThrowsOnMismatch() {
        val dir = Files.createTempDirectory("rommdeck-hash-test")
        val path = dir.resolve("game.bin")
        Files.writeString(path, "hello")
        assertFailsWith<IllegalStateException> {
            verifyRomFileHash(path.toString(), ExpectedRomHashes(sha1 = "deadbeef"))
        }
    }
}
