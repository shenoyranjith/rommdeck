package dev.rommdeck.shared.sync

import dev.rommdeck.shared.log.log

enum class SyncdRefreshStatus {
    SKIPPED,
    UPDATED,
    FAILED,
}

data class SyncdRefreshResult(
    val status: SyncdRefreshStatus,
    val message: String,
    val previousVersion: String? = null,
    val version: String? = null,
) {
    val ok: Boolean get() = status != SyncdRefreshStatus.FAILED
}

/**
 * True when the on-disk syncd install should be replaced to match [appVersion].
 * Missing / unknown stamps always refresh (covers pre-stamp installs).
 */
fun syncdNeedsRefresh(appVersion: String, installedVersion: String?): Boolean {
    val app = normalizeSyncdVersion(appVersion) ?: return false
    val installed = normalizeSyncdVersion(installedVersion) ?: return true
    return installed != app
}

fun normalizeSyncdVersion(raw: String?): String? {
    val trimmed = raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    if (trimmed.equals("unknown", ignoreCase = true)) return null
    return trimmed
}

/**
 * If the auto-sync service is installed and its stamped version differs from [appVersion],
 * reinstall syncd from the current package/dev tree and restart when it was running.
 */
fun ensureInstalledSyncdMatchesApp(appVersion: String): SyncdRefreshResult {
    if (!isAutoSyncServiceInstalled()) {
        return SyncdRefreshResult(SyncdRefreshStatus.SKIPPED, "Sync daemon is not installed")
    }

    val previous = readInstalledSyncdVersion()
    if (!syncdNeedsRefresh(appVersion, previous)) {
        return SyncdRefreshResult(
            SyncdRefreshStatus.SKIPPED,
            "Sync daemon is up to date",
            previousVersion = previous,
            version = normalizeSyncdVersion(appVersion) ?: appVersion,
        )
    }

    val wasRunning = readDaemonStatus().running
    log.info(
        "daemon",
        "refreshing syncd to match app version",
        mapOf(
            "installed" to (previous ?: "none"),
            "app" to appVersion,
            "wasRunning" to wasRunning,
        ),
    )

    val installed = installAutoSyncService()
    if (!installed.ok) {
        return SyncdRefreshResult(
            SyncdRefreshStatus.FAILED,
            installed.output.ifBlank { "Failed to update sync daemon" },
            previousVersion = previous,
            version = appVersion,
        )
    }

    val stamped = normalizeSyncdVersion(appVersion) ?: appVersion
    writeSyncdInstallManifest(syncdInstallDir(), stamped)

    if (wasRunning) {
        val restart = controlAutoSyncService(AutoSyncAction.RESTART)
        if (!restart.ok) {
            return SyncdRefreshResult(
                SyncdRefreshStatus.FAILED,
                "Updated sync daemon to v$stamped but restart failed: " +
                    restart.output.ifBlank { "unknown error" },
                previousVersion = previous,
                version = stamped,
            )
        }
    }

    return SyncdRefreshResult(
        SyncdRefreshStatus.UPDATED,
        "Updated sync daemon to v$stamped",
        previousVersion = previous,
        version = stamped,
    )
}
