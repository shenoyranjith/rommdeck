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
import dev.rommdeck.shared.romm.downloadTotalBytes
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.coroutines.coroutineContext

internal const val CatalogPageSize = 100
private const val ProgressUpdateIntervalMs = 50L
private const val MinRunningDisplayMs = 500L

enum class DownloadJobStatus { QUEUED, RUNNING, DONE, FAILED }

data class DownloadJob(
    val rom: RommRom,
    val status: DownloadJobStatus,
    val progressBytes: Long = 0,
    val totalBytes: Long? = null,
    val error: String? = null,
)

class SessionDownloadQueue {
    private val workerScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val cancelledRomIds = mutableSetOf<Int>()
    private var activeRomId: Int? = null
    private var activeDownload: Job? = null
    private var lastProgressUpdateMs = 0L
    private var runningStartedAtMs = 0L

    var jobs by mutableStateOf(listOf<DownloadJob>())
        private set
    var pumping by mutableStateOf(false)
        private set

    val queuedCount: Int get() = jobs.count { it.status == DownloadJobStatus.QUEUED }
    val runningCount: Int get() = jobs.count { it.status == DownloadJobStatus.RUNNING }
    val failedCount: Int get() = jobs.count { it.status == DownloadJobStatus.FAILED }

    /** Increments when a download completes successfully (used to refresh library state). */
    var completionCount by mutableStateOf(0)
        private set

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
                .filter { it.value.status != DownloadJobStatus.DONE }
                .sortedWith(compareBy({ rank(it.value.status) }, { it.index }))
                .map { it.value }
        }

    fun enqueue(roms: List<RommRom>): Int {
        val existing = jobs.map { it.rom.id }.toSet()
        val add = roms.filter { it.id !in existing }.map { rom ->
            DownloadJob(rom, DownloadJobStatus.QUEUED, totalBytes = rom.downloadTotalBytes())
        }
        if (add.isEmpty()) return 0
        jobs = jobs + add
        return add.size
    }

    fun cancelRom(romId: Int) {
        cancelledRomIds.add(romId)
        jobs = jobs.filterNot { it.rom.id == romId && it.status == DownloadJobStatus.QUEUED }
        if (activeRomId == romId) {
            activeDownload?.cancel()
        }
    }

    fun cancelAll() {
        jobs.filter {
            it.status == DownloadJobStatus.QUEUED || it.status == DownloadJobStatus.RUNNING
        }.forEach { cancelRom(it.rom.id) }
    }

    fun retryRom(romId: Int): Boolean {
        val index = jobs.indexOfFirst { it.rom.id == romId && it.status == DownloadJobStatus.FAILED }
        if (index < 0) return false
        cancelledRomIds.remove(romId)
        setAt(
            index,
            jobs[index].copy(
                status = DownloadJobStatus.QUEUED,
                error = null,
                progressBytes = 0,
            ),
        )
        return true
    }

    fun retryAllFailed(): Int {
        var count = 0
        jobs = jobs.map { job ->
            if (job.status != DownloadJobStatus.FAILED) return@map job
            cancelledRomIds.remove(job.rom.id)
            count++
            job.copy(status = DownloadJobStatus.QUEUED, error = null, progressBytes = 0)
        }
        return count
    }

    fun removeFailedRom(romId: Int): Boolean {
        val index = jobs.indexOfFirst { it.rom.id == romId && it.status == DownloadJobStatus.FAILED }
        if (index < 0) return false
        removeJob(romId)
        return true
    }

    fun removeAllFailed(): Int {
        val failedIds = jobs.filter { it.status == DownloadJobStatus.FAILED }.map { it.rom.id }
        failedIds.forEach { removeJob(it) }
        return failedIds.size
    }

    fun startPump(config: RommDeckConfig, paths: ResolvedPlayPaths, onDone: () -> Unit) {
        workerScope.launch {
            pump(config, paths, onDone)
        }
    }

    private fun removeJob(romId: Int) {
        cancelledRomIds.remove(romId)
        jobs = jobs.filter { it.rom.id != romId }
    }

    private fun updateProgress(romId: Int, bytes: Long, force: Boolean = false) {
        val now = System.currentTimeMillis()
        if (!force && now - lastProgressUpdateMs < ProgressUpdateIntervalMs) return
        lastProgressUpdateMs = now
        val index = jobs.indexOfFirst { it.rom.id == romId && it.status == DownloadJobStatus.RUNNING }
        if (index < 0) return
        val current = jobs[index]
        if (current.progressBytes == bytes) return
        setAt(index, current.copy(progressBytes = bytes))
    }

    private fun reportDownloadProgress(romId: Int, bytes: Long) {
        workerScope.launch(Dispatchers.Main.immediate) {
            updateProgress(romId, bytes)
        }
    }

    private suspend fun finishRunningJob(romId: Int, totalBytes: Long?) {
        updateProgress(romId, totalBytes ?: 0L, force = true)
        val elapsed = System.currentTimeMillis() - runningStartedAtMs
        if (elapsed < MinRunningDisplayMs) {
            delay(MinRunningDisplayMs - elapsed)
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
                if (job.rom.id in cancelledRomIds) {
                    removeJob(job.rom.id)
                    continue
                }
                setAt(index, job.copy(status = DownloadJobStatus.RUNNING, progressBytes = 0))
                activeRomId = job.rom.id
                runningStartedAtMs = System.currentTimeMillis()
                val romId = job.rom.id
                try {
                    withContext(Dispatchers.IO) {
                        coroutineScope {
                            activeDownload = coroutineContext[Job]
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
                                ).downloadRom(job.rom) { bytes ->
                                    reportDownloadProgress(romId, bytes)
                                }
                            } finally {
                                client.close()
                                library.close()
                            }
                        }
                    }
                    finishRunningJob(romId, job.totalBytes)
                    if (job.rom.id in cancelledRomIds) {
                        removeJob(job.rom.id)
                        continue
                    }
                    val doneIndex = jobs.indexOfFirst { it.rom.id == job.rom.id }
                    if (doneIndex >= 0) {
                        removeJob(job.rom.id)
                        completionCount++
                        onDone()
                    }
                } catch (_: CancellationException) {
                    removeJob(job.rom.id)
                } catch (e: Exception) {
                    if (job.rom.id in cancelledRomIds) {
                        removeJob(job.rom.id)
                    } else {
                        val failIndex = jobs.indexOfFirst { it.rom.id == job.rom.id }
                        if (failIndex >= 0) {
                            setAt(
                                failIndex,
                                jobs[failIndex].copy(
                                    status = DownloadJobStatus.FAILED,
                                    error = e.message ?: e.toString(),
                                ),
                            )
                        }
                    }
                } finally {
                    activeRomId = null
                    activeDownload = null
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
