package dev.rommdeck.shared.sync

import dev.rommdeck.shared.config.DEFAULT_CONFIG
import dev.rommdeck.shared.config.RommConfig
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class DaemonStatusTest {
    @Test
    fun roundTripPreservesFields() {
        val status = DaemonStatus(
            running = true,
            pid = 1234,
            lastSyncAt = "2026-08-31T00:00:00Z",
            lastResult = "ok",
            lastError = null,
            pendingConflicts = listOf("mario.srm"),
            completedOps = 2,
            failedOps = 0,
            updatedAt = "2026-08-31T00:00:01Z",
        )
        val decoded = decodeDaemonStatus(encodeDaemonStatus(status))
        assertEquals(status, decoded)
    }

    @Test
    fun invalidJsonReturnsEmpty() {
        val decoded = decodeDaemonStatus("{not json")
        assertEquals(EMPTY_DAEMON_STATUS, decoded)
    }
}

class DaemonTickSkipTest {
    @Test
    fun skipWhenDisabled() {
        val cfg = DEFAULT_CONFIG.copy(sync = DEFAULT_CONFIG.sync.copy(enabled = false))
        assertEquals("auto-sync disabled in config", skipAutoSyncReason(cfg))
    }

    @Test
    fun skipWhenRommMissing() {
        val cfg = DEFAULT_CONFIG.copy(
            romm = RommConfig(),
            sync = DEFAULT_CONFIG.sync.copy(enabled = true),
        )
        assertEquals("RomM not configured", skipAutoSyncReason(cfg))
    }
}

class SystemdUnitTest {
    @Test
    fun unitContainsExecStart() {
        val text = systemdUnitText("/home/me/.local/bin/rommdeck-syncd")
        assertTrue(text.contains("ExecStart=/home/me/.local/bin/rommdeck-syncd"))
        assertTrue(text.contains("Restart=on-failure"))
    }

    @Test
    fun wrapperExecsSidecar() {
        val script = unixWrapperScript("/data/syncd/bin/rommdeck-syncd")
        assertTrue(script.startsWith("#!/usr/bin/env bash"))
        assertTrue(script.contains("exec '/data/syncd/bin/rommdeck-syncd'"))
    }
}
