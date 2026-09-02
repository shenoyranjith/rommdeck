package dev.rommdeck.shared.esde

import dev.rommdeck.shared.log.log
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import kotlin.coroutines.coroutineContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.job
import kotlinx.coroutines.sync.Mutex

private const val SHUTDOWN_WAIT_MS = 5_000L

object GamelistWriteQueue {
    private val mutexes = ConcurrentHashMap<String, Mutex>()
    private val inFlight = AtomicInteger(0)

    @Volatile
    private var rejectNew = false

    @Volatile
    private var activeRelease: (() -> Unit)? = null

    fun isWriteActive(): Boolean = inFlight.get() > 0

    suspend fun <T> run(gamelistPath: String, block: suspend () -> T): T {
        if (rejectNew) throw CancellationException("gamelist writes shutting down")
        val mutex = mutexes.getOrPut(gamelistPath) { Mutex() }
        mutex.lock()
        try {
            coroutineContext.ensureActive()
            val job = coroutineContext.job
            inFlight.incrementAndGet()
            try {
                return withFileLockCancellable(
                    lockPath = gamelistLockPath(gamelistPath),
                    isCancelled = { !job.isActive || rejectNew },
                    onLockAcquired = { release -> activeRelease = release },
                ) {
                    coroutineContext.ensureActive()
                    block()
                }
            } finally {
                inFlight.decrementAndGet()
                activeRelease = null
            }
        } finally {
            mutex.unlock()
        }
    }

    suspend fun shutdown(waitMs: Long = SHUTDOWN_WAIT_MS) {
        rejectNew = true
        val deadline = System.currentTimeMillis() + waitMs
        while (inFlight.get() > 0 && System.currentTimeMillis() < deadline) {
            delay(20)
        }
        if (inFlight.get() > 0) {
            log.info(
                "esde",
                "gamelist shutdown: forcing lock release",
                mapOf("inFlight" to inFlight.get()),
            )
            activeRelease?.invoke()
            activeRelease = null
            inFlight.set(0)
        }
    }
}

fun isGamelistWriteActive(): Boolean = GamelistWriteQueue.isWriteActive()

suspend fun shutdownGamelistWrites(waitMs: Long = SHUTDOWN_WAIT_MS) {
    GamelistWriteQueue.shutdown(waitMs)
}
