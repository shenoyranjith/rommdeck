package dev.rommdeck.shared.romm

import io.ktor.client.HttpClient

expect fun createPlatformHttpClient(): HttpClient

internal fun createRommHttpClient(): HttpClient = createPlatformHttpClient()
