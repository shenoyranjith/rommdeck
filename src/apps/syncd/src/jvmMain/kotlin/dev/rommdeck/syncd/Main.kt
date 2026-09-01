package dev.rommdeck.syncd

import dev.rommdeck.shared.sync.runSyncDaemon
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.runBlocking

fun main() = runBlocking {
    val job = coroutineContext[Job]!!
    Runtime.getRuntime().addShutdownHook(Thread { job.cancel() })
    try {
        runSyncDaemon()
    } catch (_: CancellationException) {
    }
}
