package dev.rommdeck.shared.sync

import dev.rommdeck.shared.config.RommDeckConfig
import dev.rommdeck.shared.config.createConfigRepository
import dev.rommdeck.shared.io.currentTimeIso
import dev.rommdeck.shared.log.log
import dev.rommdeck.shared.play.resolvePlayPaths

fun skipAutoSyncReason(cfg: RommDeckConfig): String? {
    if (!cfg.sync.enabled) return "auto-sync disabled in config"
    if (cfg.romm.baseUrl.isBlank() || cfg.romm.apiToken.isBlank()) return "RomM not configured"
    val play = resolvePlayPaths(cfg.playTarget)
    if (play.savesPath.isBlank() || play.statesPath.isBlank()) return "saves/states paths missing"
    return null
}

suspend fun runDaemonTick(reason: String, pid: Long) {
    val cfg = createConfigRepository().load()
    val skip = skipAutoSyncReason(cfg)
    if (skip != null) {
        log.info("daemon", "skip sync ($reason): $skip")
        if (skip != "auto-sync disabled in config") {
            persistDaemonStatus {
                it.copy(
                    running = true,
                    pid = pid,
                    lastResult = "error",
                    lastError = skip,
                )
            }
        }
        return
    }

    try {
        log.info("daemon", "sync start ($reason)", mapOf("deviceId" to (cfg.sync.deviceId ?: "")))
        val result = runConfiguredSync(unattended = true)
        val lastResult = when {
            result.failed == 0 && result.conflicts.isEmpty() -> "ok"
            result.completed > 0 -> "partial"
            else -> "error"
        }
        persistDaemonStatus {
            it.copy(
                running = true,
                pid = pid,
                lastSyncAt = currentTimeIso(),
                lastResult = lastResult,
                lastError = result.errors.firstOrNull(),
                pendingConflicts = result.conflicts.map { op -> op.file },
                completedOps = result.completed,
                failedOps = result.failed,
            )
        }
        log.info(
            "daemon",
            "sync done ($reason)",
            mapOf(
                "completed" to result.completed,
                "failed" to result.failed,
                "conflicts" to result.conflicts.size,
                "lastResult" to lastResult,
            ),
        )
    } catch (e: Exception) {
        val msg = e.message ?: e.toString()
        log.error("daemon", "sync error ($reason)", mapOf("error" to msg))
        persistDaemonStatus {
            it.copy(
                running = true,
                pid = pid,
                lastSyncAt = currentTimeIso(),
                lastResult = "error",
                lastError = msg,
            )
        }
    }
}
