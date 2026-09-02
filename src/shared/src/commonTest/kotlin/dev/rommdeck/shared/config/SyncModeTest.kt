package dev.rommdeck.shared.config

import dev.rommdeck.shared.romm.SyncOpAction
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SyncModeTest {
    @Test
    fun toRommApiSyncModeUsesApiForDirectionalModes() {
        assertEquals("push_pull", SyncMode.PUSH_PULL.toRommApiSyncMode())
        assertEquals("api", SyncMode.PULL_ONLY.toRommApiSyncMode())
        assertEquals("api", SyncMode.PUSH_ONLY.toRommApiSyncMode())
    }

    @Test
    fun allowsSyncOpRespectsDirection() {
        assertTrue(SyncMode.PUSH_PULL.allowsSyncOp(SyncOpAction.UPLOAD))
        assertTrue(SyncMode.PUSH_PULL.allowsSyncOp(SyncOpAction.DOWNLOAD))

        assertFalse(SyncMode.PULL_ONLY.allowsSyncOp(SyncOpAction.UPLOAD))
        assertTrue(SyncMode.PULL_ONLY.allowsSyncOp(SyncOpAction.DOWNLOAD))

        assertTrue(SyncMode.PUSH_ONLY.allowsSyncOp(SyncOpAction.UPLOAD))
        assertFalse(SyncMode.PUSH_ONLY.allowsSyncOp(SyncOpAction.DOWNLOAD))
    }

    @Test
    fun normalizeRommApiSyncModeMapsDirectionalModesToApi() {
        assertEquals("api", normalizeRommApiSyncMode("pull_only"))
        assertEquals("api", normalizeRommApiSyncMode("push_only"))
        assertEquals("push_pull", normalizeRommApiSyncMode("push_pull"))
    }
}
