package dev.rommdeck.shared.sync

import dev.rommdeck.shared.config.createConfigRepository
import dev.rommdeck.shared.log.log
import dev.rommdeck.shared.paths.AppPaths
import dev.rommdeck.shared.play.resolvePlayPaths
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.job
import kotlinx.coroutines.launch
import kotlinx.coroutines.runInterruptible
import java.nio.file.ClosedWatchServiceException
import java.nio.file.FileSystems
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardWatchEventKinds
import java.nio.file.WatchKey

suspend fun runSyncDaemon() {
    val pid = ProcessHandle.current().pid()
    val repo = createConfigRepository()
    val cfg = repo.load()
    persistDaemonStatus { it.copy(running = true, pid = pid, lastError = null) }
    log.info(
        "daemon",
        "rommdeck-syncd starting",
        mapOf(
            "pid" to pid,
            "enabled" to cfg.sync.enabled,
            "intervalSeconds" to cfg.sync.intervalSeconds,
            "debounceSeconds" to cfg.sync.debounceSeconds,
            "logLevel" to cfg.logging.level.name.lowercase(),
        ),
    )

    coroutineScope {
        val trigger = SyncTrigger(this) { reason -> runDaemonTick(reason, pid) }
        trigger.debounceMs = maxOf(5, cfg.sync.debounceSeconds) * 1000L
        var intervalJob: Job? = null

        fun applyInterval(seconds: Int) {
            intervalJob?.cancel()
            val intervalMs = maxOf(60, seconds) * 1000L
            intervalJob = launch {
                while (isActive) {
                    delay(intervalMs)
                    trigger.trigger("interval")
                }
            }
        }

        applyInterval(cfg.sync.intervalSeconds)

        val play = resolvePlayPaths(cfg.playTarget)
        val watchRoots = listOf(play.savesPath, play.statesPath).filter { it.isNotBlank() }
        launch {
            watchDirectories(watchRoots) {
                log.debug("daemon", "fs event", emptyMap())
                trigger.scheduleDebounced()
            }
        }
        launch {
            watchConfigFile {
                val current = repo.load()
                trigger.debounceMs = maxOf(5, current.sync.debounceSeconds) * 1000L
                applyInterval(current.sync.intervalSeconds)
                log.info(
                    "daemon",
                    "config reloaded",
                    mapOf(
                        "enabled" to current.sync.enabled,
                        "intervalSeconds" to current.sync.intervalSeconds,
                        "debounceSeconds" to current.sync.debounceSeconds,
                        "logLevel" to current.logging.level.name.lowercase(),
                    ),
                )
            }
        }

        if (cfg.sync.enabled) {
            launch {
                delay(2_000)
                trigger.trigger("startup")
            }
        } else {
            log.info("daemon", "auto-sync disabled — idle until enabled in config")
        }

        try {
            awaitCancellation()
        } finally {
            persistDaemonStatus { it.copy(running = false, pid = null) }
            log.info("daemon", "shutting down")
        }
    }
}

internal suspend fun watchDirectories(roots: List<String>, onEvent: () -> Unit) {
    val paths = roots.map { Path.of(it) }.filter { Files.isDirectory(it) }
    if (paths.isEmpty()) {
        log.info("daemon", "no saves/states paths to watch")
        awaitCancellation()
        return
    }
    log.info("daemon", "watching save paths", mapOf("roots" to paths.joinToString()))
    watchPaths(paths, fileNameFilter = null, onEvent)
}

internal suspend fun watchConfigFile(onChange: () -> Unit) {
    val file = Path.of(AppPaths.configFile())
    val dir = file.parent ?: run {
        awaitCancellation()
        return
    }
    Files.createDirectories(dir)
    watchPaths(listOf(dir), fileNameFilter = file.fileName.toString(), onChange)
}

private suspend fun watchPaths(
    roots: List<Path>,
    fileNameFilter: String?,
    onEvent: () -> Unit,
) {
    val watcher = FileSystems.getDefault().newWatchService()
    val keys = HashMap<WatchKey, Path>()

    fun register(dir: Path) {
        val key = dir.register(
            watcher,
            StandardWatchEventKinds.ENTRY_CREATE,
            StandardWatchEventKinds.ENTRY_DELETE,
            StandardWatchEventKinds.ENTRY_MODIFY,
        )
        keys[key] = dir
    }

    fun registerTree(root: Path) {
        try {
            Files.walk(root).use { stream ->
                stream.filter { Files.isDirectory(it) }.forEach { register(it) }
            }
        } catch (_: Exception) {
            if (Files.isDirectory(root)) register(root)
        }
    }

    roots.forEach { registerTree(it) }
    currentCoroutineContext().job.invokeOnCompletion {
        try {
            watcher.close()
        } catch (_: Exception) {
        }
    }

    try {
        while (currentCoroutineContext().isActive) {
            val key = try {
                runInterruptible(Dispatchers.IO) { watcher.take() }
            } catch (_: ClosedWatchServiceException) {
                break
            } catch (_: InterruptedException) {
                break
            }
            val dir = keys[key] ?: continue
            var fire = false
            for (event in key.pollEvents()) {
                val kind = event.kind()
                if (kind == StandardWatchEventKinds.OVERFLOW) {
                    fire = true
                    continue
                }
                val name = event.context() as? Path ?: continue
                val child = dir.resolve(name)
                if (kind == StandardWatchEventKinds.ENTRY_CREATE &&
                    fileNameFilter == null &&
                    Files.isDirectory(child)
                ) {
                    registerTree(child)
                }
                if (fileNameFilter == null || name.toString() == fileNameFilter) {
                    fire = true
                }
            }
            if (fire) onEvent()
            if (!key.reset()) keys.remove(key)
        }
    } finally {
        watcher.close()
    }
}
