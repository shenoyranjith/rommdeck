package dev.rommdeck.shared.paths

actual object AppPaths {
    actual fun configDir(): String =
        System.getenv("ROMMDECK_CONFIG_DIR") ?: "${homeDir()}/.config/rommdeck"

    actual fun dataDir(): String =
        System.getenv("ROMMDECK_DATA_DIR") ?: "${homeDir()}/.local/share/rommdeck"

    actual fun configFile(): String = "${configDir()}/config.json"

    actual fun libraryDbFile(): String = "${dataDir()}/library.db"

    actual fun daemonStatusFile(): String = "${dataDir()}/daemon-status.json"

    actual fun logsDir(): String = "${dataDir()}/logs"

    actual fun appLogFile(): String = "${logsDir()}/rommdeck.log"

    actual fun downloadQueueFile(): String = "${dataDir()}/download-queue.json"

    fun defaultRetroDeckJsonPath(): String =
        "${homeDir()}/.var/app/net.retrodeck.retrodeck/config/retrodeck/retrodeck.json"

    private fun homeDir(): String =
        System.getenv("HOME") ?: System.getProperty("user.home")
}
