package dev.rommdeck.shared.play

import dev.rommdeck.shared.config.PlayTargetConfig

actual fun resolvePlayPaths(playTarget: PlayTargetConfig): ResolvedPlayPaths =
    ResolvedPlayPaths(
        romsPath = playTarget.romsPath,
        savesPath = playTarget.savesPath,
        statesPath = playTarget.statesPath,
        downloadedMediaPath = "",
        esdeHomePath = "",
        retrodeckJsonPath = "",
        source = PathSource.UNCONFIGURED,
    )
