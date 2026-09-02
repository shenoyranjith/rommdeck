package dev.rommdeck.shared.sync

import dev.rommdeck.shared.config.createConfigRepository
import dev.rommdeck.shared.db.openLibraryIndex
import dev.rommdeck.shared.play.resolvePlayPaths
import dev.rommdeck.shared.romm.createRommClient

suspend fun runConfiguredSync(unattended: Boolean = true): SyncResult {
    val repo = createConfigRepository()
    val cfg = repo.load()
    if (cfg.romm.baseUrl.isBlank() || cfg.romm.apiToken.isBlank()) {
        error("RomM is not configured")
    }
    val play = resolvePlayPaths(cfg.playTarget)
    if (play.savesPath.isBlank() || play.statesPath.isBlank()) {
        error("Saves/states paths are not resolved")
    }
    val syncPaths = SyncPaths(
        romsPath = play.romsPath,
        savesPath = play.savesPath,
        statesPath = play.statesPath,
    )
    val client = createRommClient(cfg.romm)
    val index = openLibraryIndex()
    try {
        val device = ensureDevice(
            client = client,
            deviceId = cfg.sync.deviceId,
            deviceName = cfg.sync.deviceName,
            syncMode = cfg.sync.mode,
            paths = syncPaths,
            registerNew = cfg.sync.registerNewDevice,
            resetSyncHistory = cfg.sync.resetSyncHistory,
        )
        var next = cfg
        if (cfg.sync.deviceId != device.deviceId) {
            next = next.copy(sync = next.sync.copy(deviceId = device.deviceId))
        }
        if (cfg.sync.registerNewDevice || cfg.sync.resetSyncHistory) {
            next = next.copy(
                sync = next.sync.copy(registerNewDevice = false, resetSyncHistory = false),
            )
        }
        if (next != cfg) repo.save(next)

        return runSyncSession(
            client = client,
            index = index,
            deviceId = device.deviceId,
            paths = syncPaths,
            conflictPolicy = cfg.sync.conflictPolicy,
            syncMode = cfg.sync.mode,
            unattended = unattended,
        ).copy(
            deviceRegistered = device.registered,
            deviceUpdated = device.updated,
        )
    } finally {
        client.close()
        index.close()
    }
}
