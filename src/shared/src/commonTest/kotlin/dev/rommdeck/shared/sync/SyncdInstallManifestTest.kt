package dev.rommdeck.shared.sync

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SyncdInstallManifestTest {
    @Test
    fun roundTrip() {
        val manifest = SyncdInstallManifest(version = "0.1.0", installedAt = "2026-01-02T03:04:05Z")
        val decoded = decodeSyncdInstallManifest(encodeSyncdInstallManifest(manifest))
        assertEquals(manifest, decoded)
    }

    @Test
    fun decodeIgnoresUnknownKeys() {
        val decoded = decodeSyncdInstallManifest(
            """
            {
              "version": "1.2.3",
              "extra": true
            }
            """.trimIndent(),
        )
        assertEquals("1.2.3", decoded?.version)
        assertNull(decoded?.installedAt)
    }

    @Test
    fun decodeInvalidReturnsNull() {
        assertNull(decodeSyncdInstallManifest("{not json"))
    }
}
