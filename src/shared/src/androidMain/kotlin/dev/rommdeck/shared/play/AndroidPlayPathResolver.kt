package dev.rommdeck.shared.play

import dev.rommdeck.shared.config.PlayTargetConfig

actual fun resolvePlayPaths(playTarget: PlayTargetConfig): ResolvedPlayPaths =
    ResolvedPlayPaths(
        romsPath = playTarget.romsPath,
        savesPath = playTarget.savesPath,
        statesPath = playTarget.statesPath,
        downloadedMediaPath = "",
        esdeHomePath = playTarget.esdeHomePath,
        retrodeckJsonPath = "",
        source = if (
            playTarget.romsPath.isBlank() &&
            playTarget.savesPath.isBlank() &&
            playTarget.statesPath.isBlank() &&
            playTarget.esdeHomePath.isBlank()
        ) {
            PathSource.UNCONFIGURED
        } else {
            PathSource.MANUAL
        },
    )
