package dev.rommdeck.shared.sync

import dev.rommdeck.shared.config.SyncMode
import dev.rommdeck.shared.config.toRommApiSyncMode
import dev.rommdeck.shared.io.hostName
import dev.rommdeck.shared.log.log
import dev.rommdeck.shared.romm.RommApiError
import dev.rommdeck.shared.romm.RommClient
import dev.rommdeck.shared.romm.RommDevice

data class SyncPaths(
    val romsPath: String,
    val savesPath: String,
    val statesPath: String,
)

data class EnsureDeviceResult(
    val deviceId: String,
    val registered: Boolean,
    val updated: Boolean,
)

suspend fun ensureDevice(
    client: RommClient,
    deviceId: String?,
    deviceName: String,
    syncMode: SyncMode,
    paths: SyncPaths,
    registerNew: Boolean = false,
    resetSyncHistory: Boolean = false,
): EnsureDeviceResult {
    val pathMap = mapOf(
        "roms" to paths.romsPath,
        "saves" to paths.savesPath,
        "states" to paths.statesPath,
    )
    val mode = syncMode.toRommApiSyncMode()
    val baseHost = hostName()
    val hostname = if (registerNew) "$baseHost-${slugify(deviceName)}" else baseHost

    if (!deviceId.isNullOrBlank() && !registerNew) {
        try {
            val existing = client.getDevice(deviceId)
            val needsUpdate =
                !pathsMatch(existing, paths) ||
                    !syncModeMatches(existing, syncMode) ||
                    (deviceName.isNotBlank() && existing.name != deviceName)
            if (needsUpdate) {
                client.updateDevice(deviceId, deviceName, mode, pathMap)
                log.info("sync", "device updated", mapOf("deviceId" to deviceId, "name" to deviceName))
                return EnsureDeviceResult(deviceId = deviceId, registered = false, updated = true)
            }
            log.debug("sync", "device unchanged", mapOf("deviceId" to deviceId))
            return EnsureDeviceResult(deviceId = deviceId, registered = false, updated = false)
        } catch (e: RommApiError) {
            if (e.status != 404) throw e
        }
    }

    val device = client.registerDevice(
        name = deviceName,
        // RomM device platform label; library sync uses ES-DE-shaped paths regardless of host stack.
        platform = "esde",
        hostname = hostname,
        syncMode = mode,
        paths = pathMap,
        allowDuplicate = registerNew,
        resetSyncs = resetSyncHistory,
    )
    log.info("sync", "device registered", mapOf("deviceId" to device.id))
    return EnsureDeviceResult(deviceId = device.id, registered = true, updated = false)
}

private fun pathsFromDevice(device: RommDevice): Triple<String?, String?, String?>? {
    if (device.paths.isEmpty()) return null
    return Triple(
        device.paths["roms"] ?: device.paths["roms_path"],
        device.paths["saves"] ?: device.paths["saves_path"],
        device.paths["states"] ?: device.paths["states_path"],
    )
}

private fun pathsMatch(device: RommDevice, desired: SyncPaths): Boolean {
    val current = pathsFromDevice(device) ?: return false
    return current.first == desired.romsPath &&
        current.second == desired.savesPath &&
        current.third == desired.statesPath
}

private fun syncModeMatches(device: RommDevice, mode: SyncMode): Boolean {
    val current = device.syncMode ?: return true
    val expected = mode.toRommApiSyncMode()
    if (current == expected) return true
    // Older RommDeck stored directional modes on the device; RomM no longer accepts them on write.
    return when (mode) {
        SyncMode.PULL_ONLY -> current == "pull_only"
        SyncMode.PUSH_ONLY -> current == "push_only"
        SyncMode.PUSH_PULL -> false
    }
}

private fun slugify(name: String): String {
    val slug = name.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-')
    return slug.ifEmpty { "device" }
}
