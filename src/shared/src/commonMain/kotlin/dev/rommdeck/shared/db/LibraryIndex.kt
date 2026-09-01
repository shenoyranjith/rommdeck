package dev.rommdeck.shared.db

import app.cash.sqldelight.db.SqlDriver
import dev.rommdeck.shared.log.log
import dev.rommdeck.shared.paths.AppPaths

class LibraryIndex(
    private val driver: SqlDriver,
    dbPath: String? = null,
) {
    private val db = LibraryDatabase(driver)
    private val queries = db.romFilesQueries

    init {
        log.info("index", "opened library db", mapOf("path" to (dbPath ?: "(memory)")))
    }

    fun upsertFile(row: IndexedRomFile) {
        queries.upsertFile(
            rom_id = row.romId.toLong(),
            romm_slug = row.rommSlug,
            esde_folder = row.esdeFolder,
            filename = row.filename,
            size = row.size,
            sha1 = row.sha1,
            path = row.path,
            downloaded_at = row.downloadedAt,
            verified = if (row.verified) 1 else 0,
        )
    }

    fun getByRomId(romId: Int): List<IndexedRomFile> =
        queries.selectByRomId(romId.toLong()).executeAsList().map { it.toModel() }

    fun getAll(): List<IndexedRomFile> =
        queries.selectAll().executeAsList().map { it.toModel() }

    fun getDownloadedRomIds(): Set<Int> =
        queries.selectDistinctRomIds().executeAsList().map { it.toInt() }.toSet()

    fun getDownloadedRomIdsForSlug(rommSlug: String): List<Int> =
        queries.selectDistinctRomIdsForSlug(rommSlug).executeAsList().map { it.toInt() }

    fun searchDownloadedRomIdsForSlug(rommSlug: String, query: String): List<Int> =
        queries.selectDistinctRomIdsForSlugSearch(rommSlug, query).executeAsList().map { it.toInt() }

    fun getDownloadedRomIdsForSlugPage(rommSlug: String, limit: Int, offset: Int): List<Int> =
        queries.selectDistinctRomIdsForSlugPaged(
            rommSlug,
            limit.toLong(),
            offset.toLong(),
        ).executeAsList().map { it.toInt() }

    fun searchDownloadedRomIdsForSlugPage(
        rommSlug: String,
        query: String,
        limit: Int,
        offset: Int,
    ): List<Int> =
        queries.selectDistinctRomIdsForSlugSearchPaged(
            rommSlug,
            query,
            limit.toLong(),
            offset.toLong(),
        ).executeAsList().map { it.toInt() }

    fun countDownloadedRomsForSlugSearch(rommSlug: String, query: String): Int =
        queries.countDistinctRomIdsForSlugSearch(rommSlug, query).executeAsOne().toInt()

    fun countDownloadedRomsForSlug(rommSlug: String): Int =
        queries.countDistinctRomIdsForSlug(rommSlug).executeAsOne().toInt()

    fun getStats(): LibraryStats {
        val row = queries.selectStats().executeAsOne()
        return LibraryStats(
            downloadedRoms = row.downloaded_roms.toInt(),
            storageBytes = row.storage_bytes.toLong(),
        )
    }

    fun deleteByRomId(romId: Int): List<IndexedRomFile> {
        val rows = getByRomId(romId)
        queries.deleteByRomId(romId.toLong())
        return rows
    }

    fun deleteByPath(path: String) {
        queries.deleteByPath(path)
    }

    fun findByFilename(filename: String, esdeFolder: String? = null): List<IndexedRomFile> {
        val rows = if (esdeFolder == null) {
            queries.selectByFilename(filename).executeAsList()
        } else {
            queries.selectByFilenameAndFolder(filename, esdeFolder).executeAsList()
        }
        return rows.map { it.toModel() }
    }

    fun close() {
        driver.close()
    }

    private fun Rom_files.toModel(): IndexedRomFile =
        IndexedRomFile(
            id = id,
            romId = rom_id.toInt(),
            rommSlug = romm_slug,
            esdeFolder = esde_folder,
            filename = filename,
            size = size,
            sha1 = sha1,
            path = path,
            downloadedAt = downloaded_at,
            verified = verified != 0L,
        )
}

fun openLibraryIndex(dbPath: String = AppPaths.libraryDbFile()): LibraryIndex =
    LibraryIndex(createLibrarySqlDriver(dbPath), dbPath)
