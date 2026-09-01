package dev.rommdeck.shared.config

import kotlinx.serialization.json.Json

internal val configJson = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
    prettyPrint = true
}

fun normalizeConfig(raw: RommDeckConfig): RommDeckConfig {
    val theme = if (raw.ui.theme in UI_THEMES) raw.ui.theme else DEFAULT_CONFIG.ui.theme
    val scanlineStrength = raw.ui.scanlineStrength.coerceIn(0, 100)

    val deviceId = when (val id = raw.sync.deviceId) {
        null, "" -> null
        else -> id
    }

    val logLevel = if (raw.logging.level in LOG_LEVELS) {
        raw.logging.level
    } else {
        DEFAULT_CONFIG.logging.level
    }

    return raw.copy(
        sync = raw.sync.copy(deviceId = deviceId),
        ui = raw.ui.copy(theme = theme, scanlineStrength = scanlineStrength),
        logging = LoggingConfig(logLevel),
    )
}

fun encodeConfig(config: RommDeckConfig): String =
    configJson.encodeToString(RommDeckConfig.serializer(), normalizeConfig(config))

fun decodeConfig(text: String): RommDeckConfig =
    normalizeConfig(configJson.decodeFromString(RommDeckConfig.serializer(), text))
