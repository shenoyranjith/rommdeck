package dev.rommdeck.desktop

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import dev.rommdeck.shared.config.RommConfig
import dev.rommdeck.shared.config.RommDeckConfig
import dev.rommdeck.shared.db.LibraryStats
import dev.rommdeck.shared.db.openLibraryIndex
import dev.rommdeck.shared.download.DownloadManager
import dev.rommdeck.shared.download.DownloadManagerConfig
import dev.rommdeck.shared.play.ResolvedPlayPaths
import dev.rommdeck.shared.romm.RommRom
import dev.rommdeck.shared.romm.createRommClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

internal const val CatalogPageSize = 100

enum class DownloadJobStatus { QUEUED, RUNNING, DONE, FAILED }

data class DownloadJob(
    val rom: RommRom,
    val status: DownloadJobStatus,
    val progressBytes: Long = 0,
    val error: String? = null,
)

class SessionDownloadQueue {
    var jobs by mutableStateOf(listOf<DownloadJob>())
        private set
    var pumping by mutableStateOf(false)
        private set

    val queuedCount: Int get() = jobs.count { it.status == DownloadJobStatus.QUEUED }
    val runningCount: Int get() = jobs.count { it.status == DownloadJobStatus.RUNNING }
    val failedCount: Int get() = jobs.count { it.status == DownloadJobStatus.FAILED }
    val doneCount: Int get() = jobs.count { it.status == DownloadJobStatus.DONE }

    fun enqueue(roms: List<RommRom>): Int {
        val existing = jobs.map { it.rom.id }.toSet()
        val add = roms.filter { it.id !in existing }.map { DownloadJob(it, DownloadJobStatus.QUEUED) }
        if (add.isEmpty()) return 0
        jobs = jobs + add
        return add.size
    }

    suspend fun pump(config: RommDeckConfig, paths: ResolvedPlayPaths, onDone: () -> Unit) {
        if (pumping) return
        pumping = true
        try {
            while (true) {
                val index = jobs.indexOfFirst { it.status == DownloadJobStatus.QUEUED }
                if (index < 0) break
                val job = jobs[index]
                setAt(index, job.copy(status = DownloadJobStatus.RUNNING))
                try {
                    withContext(Dispatchers.IO) {
                        val client = createRommClient(config.romm)
                        val library = openLibraryIndex()
                        try {
                            DownloadManager(
                                client = client,
                                index = library,
                                config = DownloadManagerConfig(
                                    romsPath = paths.romsPath,
                                    esdeHomePath = paths.esdeHomePath,
                                    downloadedMediaPath = paths.downloadedMediaPath,
                                    platformMapOverrides = config.platformMapOverrides,
                                    syncMetadataOnDownload = config.playTarget.syncMetadataOnDownload,
                                ),
                            ).downloadRom(job.rom)
                        } finally {
                            client.close()
                            library.close()
                        }
                    }
                    setAt(index, jobs[index].copy(status = DownloadJobStatus.DONE))
                    onDone()
                } catch (e: Exception) {
                    setAt(
                        index,
                        jobs[index].copy(
                            status = DownloadJobStatus.FAILED,
                            error = e.message ?: e.toString(),
                        ),
                    )
                }
            }
        } finally {
            pumping = false
        }
    }

    private fun setAt(index: Int, job: DownloadJob) {
        jobs = jobs.toMutableList().also { it[index] = job }
    }
}

fun loadLibraryStats(): LibraryStats {
    val index = openLibraryIndex()
    return try {
        index.getStats()
    } finally {
        index.close()
    }
}

fun loadDownloadedIds(): Set<Int> {
    val index = openLibraryIndex()
    return try {
        index.getDownloadedRomIds()
    } finally {
        index.close()
    }
}

fun loadDownloadedCountForSlug(slug: String): Int {
    val index = openLibraryIndex()
    return try {
        index.countDownloadedRomsForSlug(slug)
    } finally {
        index.close()
    }
}

fun loadDownloadedIdsPage(slug: String, limit: Int, offset: Int): List<Int> {
    val index = openLibraryIndex()
    return try {
        index.getDownloadedRomIdsForSlugPage(slug, limit, offset)
    } finally {
        index.close()
    }
}

fun searchDownloadedIdsPage(slug: String, query: String, limit: Int, offset: Int): List<Int> {
    val index = openLibraryIndex()
    return try {
        index.searchDownloadedRomIdsForSlugPage(slug, query, limit, offset)
    } finally {
        index.close()
    }
}

fun loadDownloadedSearchCount(slug: String, query: String): Int {
    val index = openLibraryIndex()
    return try {
        index.countDownloadedRomsForSlugSearch(slug, query)
    } finally {
        index.close()
    }
}

suspend fun loadDownloadedRomsPage(
    romm: RommConfig,
    slug: String,
    search: String,
    limit: Int,
    offset: Int,
): List<RommRom> {
    val ids = withContext(Dispatchers.IO) {
        if (search.isBlank()) loadDownloadedIdsPage(slug, limit, offset)
        else searchDownloadedIdsPage(slug, search, limit, offset)
    }
    return loadDownloadedRomsByIds(romm, ids)
}

private suspend fun loadDownloadedRomsByIds(romm: RommConfig, ids: List<Int>): List<RommRom> {
    if (romm.baseUrl.isBlank() || ids.isEmpty()) return emptyList()

    return withContext(Dispatchers.IO) {
        val client = createRommClient(romm)
        try {
            val concurrency = 8
            val results = arrayOfNulls<RommRom>(ids.size)
            coroutineScope {
                val work = Channel<Int>(ids.size)
                ids.indices.forEach { work.send(it) }
                work.close()
                repeat(minOf(concurrency, ids.size)) {
                    launch {
                        for (idx in work) {
                            results[idx] = try {
                                client.getRom(ids[idx])
                            } catch (_: Exception) {
                                null
                            }
                        }
                    }
                }
            }
            results.filterNotNull()
        } finally {
            client.close()
        }
    }
}
