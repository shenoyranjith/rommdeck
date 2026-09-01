package dev.rommdeck.shared.sync

import dev.rommdeck.shared.log.log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex

class SyncTrigger(
    private val scope: CoroutineScope,
    private val sync: suspend (reason: String) -> Unit,
) {
    private val mutex = Mutex()
    private var pending = false
    private var debounceJob: Job? = null

    var debounceMs: Long = 45_000L

    fun triggerAsync(reason: String) {
        scope.launch { trigger(reason) }
    }

    suspend fun trigger(reason: String) {
        if (!mutex.tryLock()) {
            pending = true
            log.debug("daemon", "sync queued", mapOf("reason" to reason))
            return
        }
        var nextReason = reason
        try {
            while (true) {
                pending = false
                try {
                    sync(nextReason)
                } catch (e: kotlinx.coroutines.CancellationException) {
                    throw e
                } catch (e: Exception) {
                    log.error(
                        "daemon",
                        "sync error ($nextReason)",
                        mapOf("error" to (e.message ?: e.toString())),
                    )
                }
                if (!pending) break
                nextReason = "queued"
            }
        } finally {
            mutex.unlock()
        }
    }

    fun scheduleDebounced() {
        debounceJob?.cancel()
        debounceJob = scope.launch {
            delay(debounceMs)
            trigger("fs-watch")
        }
    }
}
