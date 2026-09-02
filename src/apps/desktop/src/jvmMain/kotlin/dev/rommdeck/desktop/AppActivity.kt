package dev.rommdeck.desktop

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import dev.rommdeck.shared.esde.isGamelistWriteActive
import dev.rommdeck.shared.esde.shutdownGamelistWrites
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext

class AppActivityState {
    var libraryBusy by mutableStateOf(false)
        private set
    var libraryBusyKind by mutableStateOf<LibraryBusyKind?>(null)
        private set

    private var libraryJob: Job? = null

    val hasLibraryWork: Boolean get() = libraryBusy

    fun updateLibraryBusy(busy: Boolean, kind: LibraryBusyKind?, job: Job? = null) {
        libraryBusy = busy
        libraryBusyKind = if (busy) kind else null
        libraryJob = if (busy) job else null
    }

    fun libraryWorkLabel(): String? = when (libraryBusyKind) {
        LibraryBusyKind.DELETE -> "bulk delete in progress"
        LibraryBusyKind.DOWNLOAD -> "queuing downloads"
        LibraryBusyKind.PLATFORM -> "queuing platform downloads"
        null -> null
    }

    suspend fun cancelLibraryWork() {
        val job = libraryJob ?: return
        job.cancel()
        withContext(NonCancellable) {
            job.join()
        }
        libraryBusy = false
        libraryBusyKind = null
        libraryJob = null
    }
}

fun shouldConfirmQuit(queue: SessionDownloadQueue, activity: AppActivityState): Boolean =
    queue.hasActiveWork || activity.hasLibraryWork || isGamelistWriteActive()

fun quitConfirmTitle(queue: SessionDownloadQueue, activity: AppActivityState): String = when {
    queue.hasActiveWork && !activity.hasLibraryWork -> "Active transfers"
    activity.hasLibraryWork && !queue.hasActiveWork -> "Library operation in progress"
    else -> "Work in progress"
}

fun quitConfirmDetail(queue: SessionDownloadQueue, activity: AppActivityState): String {
    val parts = buildList {
        if (queue.runningCount > 0) add("${queue.runningCount} downloading")
        if (queue.queuedCount > 0) add("${queue.queuedCount} queued")
        if (queue.metadataCount > 0) add("${queue.metadataCount} writing metadata")
        activity.libraryWorkLabel()?.let { add(it) }
        if (isGamelistWriteActive()) add("gamelist.xml write in progress")
    }
    val summary = if (parts.isEmpty()) "work in progress" else parts.joinToString(" · ")
    return buildString {
        append(summary)
        append("\n\nQuit anyway? Your download queue will be saved and resumed next launch.")
        append(" ROM files already on disk are kept.")
        append(" Incomplete downloads, metadata, and library operations may need to be retried.")
    }
}

suspend fun performAppQuit(queue: SessionDownloadQueue, activity: AppActivityState) {
    withContext(Dispatchers.IO) {
        activity.cancelLibraryWork()
        queue.prepareForShutdown()
    }
}
