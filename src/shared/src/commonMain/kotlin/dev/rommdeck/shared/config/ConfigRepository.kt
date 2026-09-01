package dev.rommdeck.shared.config

expect class ConfigRepository {
    fun load(): RommDeckConfig
    fun save(config: RommDeckConfig)
    fun update(patch: RommDeckConfig): RommDeckConfig
}

expect fun createConfigRepository(): ConfigRepository
