package dev.rommdeck.shared.config

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ConfigCodecTest {
    @Test
    fun decodeFillsDefaultsForMissingFields() {
        val cfg = decodeConfig(
            """
            {
              "romm": { "baseUrl": "http://romm.local" }
            }
            """.trimIndent(),
        )
        assertEquals("http://romm.local", cfg.romm.baseUrl)
        assertEquals(LogLevel.INFO, cfg.logging.level)
        assertEquals(SyncMode.PUSH_PULL, cfg.sync.mode)
    }

    @Test
    fun normalizeEmptyDeviceIdToNull() {
        val cfg = decodeConfig("""{"sync":{"deviceId":""}}""")
        assertNull(cfg.sync.deviceId)
    }

    @Test
    fun roundTripKeepsRetrodeckKey() {
        val encoded = encodeConfig(DEFAULT_CONFIG.copy(romm = RommConfig(baseUrl = "http://test")))
        assert(encoded.contains("\"retrodeck\""))
        val decoded = decodeConfig(encoded)
        assertEquals("http://test", decoded.romm.baseUrl)
    }
}
