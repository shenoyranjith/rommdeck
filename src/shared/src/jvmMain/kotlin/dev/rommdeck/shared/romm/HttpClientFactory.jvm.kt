package dev.rommdeck.shared.romm

import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.serialization.kotlinx.json.json

actual fun createPlatformHttpClient(): HttpClient = HttpClient(CIO) {
    install(ContentNegotiation) {
        json(rommJson)
    }
}
