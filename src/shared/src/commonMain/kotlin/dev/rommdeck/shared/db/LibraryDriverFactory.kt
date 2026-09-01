package dev.rommdeck.shared.db

import app.cash.sqldelight.db.SqlDriver

expect fun createLibrarySqlDriver(dbPath: String): SqlDriver
