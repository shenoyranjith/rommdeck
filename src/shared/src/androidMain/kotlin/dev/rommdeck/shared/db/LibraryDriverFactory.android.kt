package dev.rommdeck.shared.db

import app.cash.sqldelight.db.SqlDriver

actual fun createLibrarySqlDriver(dbPath: String): SqlDriver {
    error("Android SQLDelight driver needs Context — Layer 8")
}
