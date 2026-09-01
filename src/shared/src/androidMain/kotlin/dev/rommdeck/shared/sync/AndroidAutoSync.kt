package dev.rommdeck.shared.sync

actual fun isAutoSyncServiceInstalled(): Boolean = false

actual fun installAutoSyncService(): ServiceCommandResult =
    ServiceCommandResult(false, "Android auto-sync (WorkManager) is Layer 8")

actual fun controlAutoSyncService(action: AutoSyncAction): ServiceCommandResult =
    ServiceCommandResult(false, "Android auto-sync (WorkManager) is Layer 8")
