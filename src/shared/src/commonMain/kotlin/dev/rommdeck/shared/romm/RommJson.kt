package dev.rommdeck.shared.romm

import kotlinx.serialization.json.Json

internal val rommJson = Json {
    ignoreUnknownKeys = true
    isLenient = true
    encodeDefaults = false
}
