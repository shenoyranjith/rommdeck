package dev.rommdeck.desktop

enum class NavTab(val label: String) {
    LIBRARY("Library"),
    DOWNLOADS("Downloads"),
    SYNC("Sync"),
    SETTINGS("Settings"),
}

enum class SettingsSection(val label: String) {
    APPEARANCE("Appearance"),
    ROMM("RomM"),
    PLAY("Target"),
    AUTO_SYNC("Auto-sync"),
    LOGGING("Logging"),
}

enum class RomFilter(val label: String) {
    ALL("All"),
    DOWNLOADED("Downloaded"),
    MISSING("Missing"),
}
