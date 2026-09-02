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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
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
    private val workerScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    var jobs by mutableStateOf(listOf<DownloadJob>())
        private set
    var pumping by mutableStateOf(false)
        private set

    val queuedCount: Int get() = jobs.count { it.status == DownloadJobStatus.QUEUED }
    val runningCount: Int get() = jobs.count { it.status == DownloadJobStatus.RUNNING }
    val failedCount: Int get() = jobs.count { it.status == DownloadJobStatus.FAILED }
    val doneCount: Int get() = jobs.count { it.status == DownloadJobStatus.DONE }

    val hasActiveWork: Boolean
        get() = jobs.any { it.status == DownloadJobStatus.QUEUED || it.status == DownloadJobStatus.RUNNING }

    val displayJobs: List<DownloadJob>
        get() {
            fun rank(status: DownloadJobStatus) = when (status) {
                DownloadJobStatus.RUNNING -> 0
                DownloadJobStatus.QUEUED -> 1
                DownloadJobStatus.FAILED -> 2
                DownloadJobStatus.DONE -> 3
            }
            return jobs.withIndex()
                .sortedWith(compareBy({ rank(it.value.status) }, { it.index }))
                .map { it.value }
        }

    fun enqueue(roms: List<RommRom>): Int {
        val existing = jobs.map { it.rom.id }.toSet()
        val add = roms.filter { it.id !in existing }.map { DownloadJob(it, DownloadJobStatus.QUEUED) }
        if (add.isEmpty()) return 0
        jobs = jobs + add
        return add.size
    }

    fun startPump(config: RommDeckConfig, paths: ResolvedPlayPaths, onDone: () -> Unit) {
        workerScope.launch {
            pump(config, paths, onDone)
        }
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

fun loadDownloadedIdsForSlug(slug: String): Set<Int> {
    val index = openLibraryIndex()
    return try {
        index.getDownloadedRomIdsForSlug(slug).toSet()
    } finally {
        index.close()
    }
}

fun loadAllDownloadedIdsForSlug(slug: String, search: String): List<Int> {
    val index = openLibraryIndex()
    return try {
        if (search.isBlank()) {
            index.getDownloadedRomIdsForSlug(slug)
        } else {
            val all = mutableListOf<Int>()
            var offset = 0
            while (true) {
                val page = index.searchDownloadedRomIdsForSlugPage(
                    slug,
                    search,
                    CatalogPageSize,
                    offset,
                )
                if (page.isEmpty()) break
                all += page
                offset += page.size
            }
            all
        }
    } finally {
        index.close()
    }
}

suspend fun fetchAllCatalogRoms(
    romm: RommConfig,
    platformId: Int,
    search: String?,
): List<RommRom> = withContext(Dispatchers.IO) {
    val client = createRommClient(romm)
    try {
        val all = mutableListOf<RommRom>()
        var offset = 0
        var total = Int.MAX_VALUE
        while (offset < total) {
            val page = client.getRoms(platformId, search, CatalogPageSize, offset)
            total = page.total
            all += page.items
            offset += page.items.size
            if (page.items.isEmpty()) break
        }
        all
    } finally {
        client.close()
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
