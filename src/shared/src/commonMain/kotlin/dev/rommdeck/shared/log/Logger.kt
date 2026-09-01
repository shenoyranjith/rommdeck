package dev.rommdeck.shared.log

import dev.rommdeck.shared.config.LogLevel

expect fun configureLogging(level: LogLevel)

expect fun getConfiguredLogLevel(): LogLevel

interface Logger {
    fun debug(scope: String, message: String, data: Map<String, Any?> = emptyMap())
    fun info(scope: String, message: String, data: Map<String, Any?> = emptyMap())
    fun warn(scope: String, message: String, data: Map<String, Any?> = emptyMap())
    fun error(scope: String, message: String, data: Map<String, Any?> = emptyMap())
}

expect val log: Logger
