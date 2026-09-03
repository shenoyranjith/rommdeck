package dev.rommdeck.shared.sync

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SyncdRefreshTest {
    @Test
    fun needsRefreshWhenMissingOrUnknown() {
        assertTrue(syncdNeedsRefresh("0.1.0", null))
        assertTrue(syncdNeedsRefresh("0.1.0", ""))
        assertTrue(syncdNeedsRefresh("0.1.0", "unknown"))
        assertTrue(syncdNeedsRefresh("0.1.0", "UNKNOWN"))
    }

    @Test
    fun needsRefreshWhenVersionsDiffer() {
        assertTrue(syncdNeedsRefresh("0.2.0", "0.1.0"))
        assertTrue(syncdNeedsRefresh("0.1.0+abc", "0.1.0"))
    }

    @Test
    fun skipsWhenVersionsMatch() {
        assertFalse(syncdNeedsRefresh("0.1.0", "0.1.0"))
        assertFalse(syncdNeedsRefresh(" 0.1.0 ", "0.1.0"))
    }

    @Test
    fun skipsWhenAppVersionBlank() {
        assertFalse(syncdNeedsRefresh("", "0.1.0"))
        assertFalse(syncdNeedsRefresh("   ", null))
    }
}
