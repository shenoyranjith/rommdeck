package dev.rommdeck.shared.config

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class LogLevel {
    @SerialName("debug") DEBUG,
    @SerialName("info") INFO,
    @SerialName("warn") WARN,
    @SerialName("error") ERROR,
}

@Serializable
enum class ConflictPolicy {
    @SerialName("keep_both") KEEP_BOTH,
    @SerialName("server_wins") SERVER_WINS,
    @SerialName("device_wins") DEVICE_WINS,
}

@Serializable
enum class SyncMode {
    @SerialName("push_pull") PUSH_PULL,
    @SerialName("pull_only") PULL_ONLY,
    @SerialName("push_only") PUSH_ONLY,
}

@Serializable
enum class UiTheme {
    @SerialName("candy") CANDY,
    @SerialName("gold") GOLD,
    @SerialName("vector") VECTOR,
    @SerialName("mint") MINT,
}

@Serializable
data class RommConfig(
    val baseUrl: String = "",
    val apiToken: String = "",
)

/** ES-DE play paths; serialized as `retrodeck` for compatibility with the TypeScript app. */
@Serializable
data class PlayTargetConfig(
    /** Path to retrodeck.json; empty = auto-detect on Linux when RetroDECK is installed. */
    val configPath: String = "",
    val romsPath: String = "",
    val savesPath: String = "",
    val statesPath: String = "",
    val syncMetadataOnDownload: Boolean = true,
)

@Serializable
data class SyncConfig(
    val enabled: Boolean = false,
    val mode: SyncMode = SyncMode.PUSH_PULL,
    val intervalSeconds: Int = 300,
    val debounceSeconds: Int = 45,
    val conflictPolicy: ConflictPolicy = ConflictPolicy.KEEP_BOTH,
    val deviceId: String? = null,
    val deviceName: String = "RommDeck",
    val registerNewDevice: Boolean = false,
    val resetSyncHistory: Boolean = false,
)

@Serializable
data class UiConfig(
    val theme: UiTheme = UiTheme.CANDY,
    val scanlines: Boolean = true,
    val scanlineStrength: Int = 12,
)

@Serializable
data class LoggingConfig(
    val level: LogLevel = LogLevel.INFO,
)

@Serializable
data class RommDeckConfig(
    val romm: RommConfig = RommConfig(),
    @SerialName("retrodeck") val playTarget: PlayTargetConfig = PlayTargetConfig(),
    val sync: SyncConfig = SyncConfig(),
    val ui: UiConfig = UiConfig(),
    val logging: LoggingConfig = LoggingConfig(),
    val platformMapOverrides: Map<String, String> = emptyMap(),
)

val DEFAULT_CONFIG = RommDeckConfig()

val UI_THEMES = listOf(UiTheme.CANDY, UiTheme.GOLD, UiTheme.VECTOR, UiTheme.MINT)

val LOG_LEVELS = listOf(LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR)
