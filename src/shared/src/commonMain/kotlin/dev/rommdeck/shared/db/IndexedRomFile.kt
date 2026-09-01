package dev.rommdeck.shared.db

data class IndexedRomFile(
    val id: Long? = null,
    val romId: Int,
    val rommSlug: String,
    val esdeFolder: String,
    val filename: String,
    val size: Long? = null,
    val sha1: String? = null,
    val path: String,
    val downloadedAt: String,
    val verified: Boolean = true,
)

data class LibraryStats(
    val downloadedRoms: Int,
    val storageBytes: Long,
)
