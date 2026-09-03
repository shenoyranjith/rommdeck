package dev.rommdeck.shared.config

import dev.rommdeck.shared.log.configureLogging
import dev.rommdeck.shared.paths.AppPaths
import dev.rommdeck.shared.sync.restartSyncDaemonIfActive
import java.nio.file.Path
import kotlin.io.path.createDirectories
import kotlin.io.path.exists
import kotlin.io.path.readText
import kotlin.io.path.writeText

actual class ConfigRepository {
    actual fun load(): RommDeckConfig {
        val path = Path.of(AppPaths.configFile())
        if (!path.exists()) {
            val defaults = DEFAULT_CONFIG
            configureLogging(defaults.logging.level)
            return defaults
        }
        val config = decodeConfig(path.readText())
        configureLogging(config.logging.level)
        return config
    }

    actual fun save(config: RommDeckConfig) {
        val normalized = normalizeConfig(config)
        configureLogging(normalized.logging.level)
        Path.of(AppPaths.configDir()).createDirectories()
        Path.of(AppPaths.configFile()).writeText(encodeConfig(normalized))
    }

    actual fun update(patch: RommDeckConfig): RommDeckConfig {
        val current = load()
        val next = mergeConfigPatch(current, patch)
        save(next)
        return next
    }
}

actual fun createConfigRepository(): ConfigRepository = ConfigRepository()

/** Persist RomM / auto-sync settings and restart syncd when it is running. */
fun ConfigRepository.saveSyncDaemonConfig(config: RommDeckConfig) {
    save(config)
    restartSyncDaemonIfActive()
}

/** Shallow field merge for settings edits (non-empty strings win). */
internal fun mergeConfigPatch(current: RommDeckConfig, patch: RommDeckConfig): RommDeckConfig =
    normalizeConfig(
        current.copy(
            romm = current.romm.copy(
                baseUrl = patch.romm.baseUrl.ifEmpty { current.romm.baseUrl },
                apiToken = patch.romm.apiToken.ifEmpty { current.romm.apiToken },
            ),
            playTarget = current.playTarget.copy(
                configPath = patch.playTarget.configPath.ifEmpty { current.playTarget.configPath },
                romsPath = patch.playTarget.romsPath.ifEmpty { current.playTarget.romsPath },
                savesPath = patch.playTarget.savesPath.ifEmpty { current.playTarget.savesPath },
                statesPath = patch.playTarget.statesPath.ifEmpty { current.playTarget.statesPath },
                esdeHomePath = patch.playTarget.esdeHomePath.ifEmpty { current.playTarget.esdeHomePath },
                syncMetadataOnDownload = patch.playTarget.syncMetadataOnDownload,
            ),
            sync = patch.sync.copy(
                deviceId = patch.sync.deviceId ?: current.sync.deviceId,
                deviceName = patch.sync.deviceName.ifEmpty { current.sync.deviceName },
            ),
            ui = patch.ui,
            logging = patch.logging,
            platformMapOverrides = current.platformMapOverrides + patch.platformMapOverrides,
        ),
    )
