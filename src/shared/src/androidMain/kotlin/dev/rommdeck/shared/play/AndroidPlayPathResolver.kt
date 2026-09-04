package dev.rommdeck.shared.play

import dev.rommdeck.shared.config.PlayTargetConfig
import dev.rommdeck.shared.esde.resolveEsdeLayout

/**
 * Android: RetroArch + ES-DE on device. No RetroDECK, no auto-detect — user must set all Target paths.
 */
actual fun resolvePlayPaths(playTarget: PlayTargetConfig): ResolvedPlayPaths {
    if (!playTarget.isMandatoryTargetComplete()) {
        return ResolvedPlayPaths(
            romsPath = playTarget.romsPath,
            savesPath = playTarget.savesPath,
            statesPath = playTarget.statesPath,
            downloadedMediaPath = "",
            esdeHomePath = playTarget.esdeHomePath,
            retrodeckJsonPath = "",
            source = PathSource.UNCONFIGURED,
        )
    }
    val esdeHome = playTarget.esdeHomePath
    return ResolvedPlayPaths(
        romsPath = playTarget.romsPath,
        savesPath = playTarget.savesPath,
        statesPath = playTarget.statesPath,
        downloadedMediaPath = resolveEsdeLayout(esdeHome).mediaRoot,
        esdeHomePath = esdeHome,
        retrodeckJsonPath = "",
        source = PathSource.MANUAL,
    )
}
