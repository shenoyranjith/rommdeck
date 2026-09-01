package dev.rommdeck.shared.config

actual class ConfigRepository {
    actual fun load(): RommDeckConfig = DEFAULT_CONFIG

    actual fun save(config: RommDeckConfig) {
        error("Android config persistence not implemented")
    }

    actual fun update(patch: RommDeckConfig): RommDeckConfig {
        error("Android config persistence not implemented")
    }
}

actual fun createConfigRepository(): ConfigRepository = ConfigRepository()
