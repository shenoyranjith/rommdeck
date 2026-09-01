package dev.rommdeck.shared.db

import app.cash.sqldelight.db.SqlDriver
import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import java.nio.file.Files
import java.nio.file.Path

actual fun createLibrarySqlDriver(dbPath: String): SqlDriver {
    Path.of(dbPath).parent?.let { Files.createDirectories(it) }
    return JdbcSqliteDriver(
        url = "jdbc:sqlite:$dbPath",
        schema = LibraryDatabase.Schema,
    )
}

fun createInMemoryLibrarySqlDriver(): SqlDriver =
    JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY, schema = LibraryDatabase.Schema)
