package dev.rommdeck.shared.esde

import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

object GamelistWriteQueue {
    private val mutexes = ConcurrentHashMap<String, Mutex>()

    suspend fun <T> run(gamelistPath: String, block: suspend () -> T): T {
        val mutex = mutexes.getOrPut(gamelistPath) { Mutex() }
        return mutex.withLock {
            withFileLock(gamelistLockPath(gamelistPath)) {
                block()
            }
        }
    }
}
