package dev.rommdeck.shared.platform

import kotlin.test.Test
import kotlin.test.assertEquals

class PlatformMapRowsTest {
    private val bundled = mapOf(
        "snes" to "snes",
        "3ds" to "n3ds",
    )

    @Test
    fun buildRowsUsesOverridesAndDefaults() {
        val rows = buildPlatformMapRows(bundled, mapOf("snes" to "custom-snes"))
        val snes = rows.first { it.rommSlug == "snes" }
        assertEquals("custom-snes", snes.esdeFolder)
        assertEquals(PlatformMapSource.Override, snes.source)
        val threeDs = rows.first { it.rommSlug == "3ds" }
        assertEquals("n3ds", threeDs.esdeFolder)
        assertEquals(PlatformMapSource.Default, threeDs.source)
    }

    @Test
    fun overridesFromRowsOmitsUnchanged() {
        val rows = buildPlatformMapRows(bundled, mapOf("snes" to "custom-snes"))
        assertEquals(mapOf("snes" to "custom-snes"), overridesFromRows(rows, bundled))
    }

    @Test
    fun identitySourceWhenSlugNotInBundled() {
        val rows = buildPlatformMapRows(bundled, mapOf("custom-slug" to "custom-slug"))
        val custom = rows.first { it.rommSlug == "custom-slug" }
        assertEquals("custom-slug", custom.esdeFolder)
        assertEquals(PlatformMapSource.Identity, custom.source)
    }
}
