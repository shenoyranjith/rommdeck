package dev.rommdeck.shared.paths

expect object AppPaths {
    fun configDir(): String
    fun dataDir(): String
    fun configFile(): String
    fun libraryDbFile(): String
    fun daemonStatusFile(): String
    fun logsDir(): String
    fun appLogFile(): String
    fun downloadQueueFile(): String
}
