package dev.rommdeck.shared.play

enum class PathSource {
    /** Supported platform: retrodeck.json found (optional path overrides). */
    RETRODECK_AUTO,
    /** Best-effort ES-DE-style tree when RetroDECK is absent (not a first-class platform). */
    ESDE_AUTO,
    /** User-set ROM / save / state paths (EmuDeck, plain ES-DE, custom, …). */
    MANUAL,
    /** No RetroDECK detect and no manual paths. */
    UNCONFIGURED,
}

data class ResolvedPlayPaths(
    val romsPath: String,
    val savesPath: String,
    val statesPath: String,
    val downloadedMediaPath: String,
    /** Frontend home for gamelists + media (ES-DE layout under the library root). */
    val esdeHomePath: String,
    val retrodeckJsonPath: String,
    val source: PathSource,
)

expect fun resolvePlayPaths(playTarget: dev.rommdeck.shared.config.PlayTargetConfig): ResolvedPlayPaths
