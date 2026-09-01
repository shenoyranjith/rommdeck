package dev.rommdeck.shared.log

import dev.rommdeck.shared.config.LogLevel

actual fun configureLogging(level: LogLevel) = Unit

actual fun getConfiguredLogLevel(): LogLevel = LogLevel.INFO

private object AndroidLogger : Logger {
    override fun debug(scope: String, message: String, data: Map<String, Any?>) = Unit
    override fun info(scope: String, message: String, data: Map<String, Any?>) = Unit
    override fun warn(scope: String, message: String, data: Map<String, Any?>) = Unit
    override fun error(scope: String, message: String, data: Map<String, Any?>) = Unit
}

actual val log: Logger = AndroidLogger
