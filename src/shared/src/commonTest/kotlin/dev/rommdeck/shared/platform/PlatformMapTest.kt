package dev.rommdeck.shared.platform

import kotlin.test.Test
import kotlin.test.assertEquals

class PlatformMapTest {
    @Test
    fun overrideWinsOverBundled() {
        val folder = rommSlugToEsdeFolder("snes", mapOf("snes" to "custom-snes"))
        assertEquals("custom-snes", folder)
    }

    @Test
    fun unknownSlugFallsBackToIdentity() {
        assertEquals("not-a-real-slug", rommSlugToEsdeFolder("not-a-real-slug"))
    }

    @Test
    fun bundledMapRemaps3ds() {
        val folder = rommSlugToEsdeFolder("3ds")
        if (bundledPlatformMap().isNotEmpty()) {
            assertEquals("n3ds", folder)
        }
    }
}
