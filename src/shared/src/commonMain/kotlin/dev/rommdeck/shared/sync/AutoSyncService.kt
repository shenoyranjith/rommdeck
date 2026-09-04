package dev.rommdeck.shared.sync

data class ServiceCommandResult(
    val ok: Boolean,
    val output: String,
)

enum class AutoSyncAction {
    ENABLE,
    DISABLE,
    START,
    STOP,
    STATUS,
    RESTART,
}

fun systemdUnitText(execStart: String, javaHome: String? = null): String {
    val environment = if (javaHome.isNullOrBlank()) {
        ""
    } else {
        """
        |Environment=JAVA_HOME=$javaHome
        |Environment=PATH=$javaHome/bin:/usr/bin:/bin
        |
        """.trimMargin()
    }
    return """
        |[Unit]
        |Description=RommDeck save/state sync daemon
        |After=network-online.target
        |Wants=network-online.target
        |
        |[Service]
        |Type=simple
        |ExecStart=$execStart
        |${environment}Restart=on-failure
        |RestartSec=10
        |StandardOutput=journal
        |StandardError=journal
        |
        |[Install]
        |WantedBy=default.target
        |
    """.trimMargin()
}

fun launchAgentPlist(execStart: String): String = """
    |<?xml version="1.0" encoding="UTF-8"?>
    |<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    |<plist version="1.0">
    |<dict>
    |  <key>Label</key>
    |  <string>dev.rommdeck.syncd</string>
    |  <key>ProgramArguments</key>
    |  <array>
    |    <string>$execStart</string>
    |  </array>
    |  <key>RunAtLoad</key>
    |  <true/>
    |  <key>KeepAlive</key>
    |  <true/>
    |</dict>
    |</plist>
    |
""".trimMargin()

fun unixWrapperScript(execPath: String): String = """
    |#!/usr/bin/env bash
    |set -euo pipefail
    |exec '$execPath' "$@"
    |
""".trimMargin()

expect fun isAutoSyncServiceInstalled(): Boolean

expect fun installAutoSyncService(): ServiceCommandResult

expect fun controlAutoSyncService(action: AutoSyncAction): ServiceCommandResult

/** True when installed syncd has a usable JRE (bundled or system JAVA_HOME for the unit). */
expect fun isSyncdJavaRuntimeReady(): Boolean
