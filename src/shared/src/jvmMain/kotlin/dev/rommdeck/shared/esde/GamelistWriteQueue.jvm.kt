package dev.rommdeck.shared.esde

import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.coroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.job
import kotlinx.coroutines.sync.Mutex

object GamelistWriteQueue {
    private val mutexes = ConcurrentHashMap<String, Mutex>()

    suspend fun <T> run(gamelistPath: String, block: suspend () -> T): T {
        val mutex = mutexes.getOrPut(gamelistPath) { Mutex() }
        mutex.lock()
        try {
            coroutineContext.ensureActive()
            val job = coroutineContext.job
            return withFileLockCancellable(
                lockPath = gamelistLockPath(gamelistPath),
                isCancelled = { !job.isActive },
            ) {
                coroutineContext.ensureActive()
                block()
            }
        } finally {
            mutex.unlock()
        }
    }
}
