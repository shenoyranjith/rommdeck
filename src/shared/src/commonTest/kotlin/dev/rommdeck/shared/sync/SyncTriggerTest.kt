package dev.rommdeck.shared.sync

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals

@OptIn(ExperimentalCoroutinesApi::class)
class SyncTriggerTest {
    @Test
    fun debounceCoalescesEvents() = runTest {
        val reasons = mutableListOf<String>()
        val trigger = SyncTrigger(backgroundScope) { reasons += it }
        trigger.debounceMs = 1_000
        trigger.scheduleDebounced()
        trigger.scheduleDebounced()
        advanceTimeBy(999)
        runCurrent()
        assertEquals(emptyList(), reasons)
        advanceTimeBy(2)
        runCurrent()
        assertEquals(listOf("fs-watch"), reasons)
    }

    @Test
    fun queuesWhileSyncIsRunning() = runTest {
        val reasons = mutableListOf<String>()
        val gate = CompletableDeferred<Unit>()
        val trigger = SyncTrigger(this) { reason ->
            reasons += reason
            if (reason == "a") gate.await()
        }
        val first = launch { trigger.trigger("a") }
        runCurrent()
        launch { trigger.trigger("b") }
        runCurrent()
        gate.complete(Unit)
        first.join()
        runCurrent()
        assertEquals(listOf("a", "queued"), reasons)
    }
}
