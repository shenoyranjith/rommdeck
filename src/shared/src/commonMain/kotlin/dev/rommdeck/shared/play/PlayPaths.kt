package dev.rommdeck.shared.play

enum class PathSource {
    /** Linux: retrodeck.json found and paths taken from it (with optional overrides). */
    RETRODECK_AUTO,
    /** Plain ES-DE install detected; paths from ES-DE layout or config overrides. */
    ESDE_AUTO,
    /** User-set paths in config.json. */
    MANUAL,
    /** No RetroDECK / ES-DE detected and no manual paths. */
    UNCONFIGURED,
}

data class ResolvedPlayPaths(
    val romsPath: String,
    val savesPath: String,
    val statesPath: String,
    val downloadedMediaPath: String,
    /** ES-DE home (gamelists + media roots are derived from this). */
    val esdeHomePath: String,
    val retrodeckJsonPath: String,
    val source: PathSource,
)

expect fun resolvePlayPaths(playTarget: dev.rommdeck.shared.config.PlayTargetConfig): ResolvedPlayPaths
