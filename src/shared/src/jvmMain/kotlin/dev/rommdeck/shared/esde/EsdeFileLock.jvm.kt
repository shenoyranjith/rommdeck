package dev.rommdeck.shared.esde

import java.io.File
import java.nio.file.Files
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.delay

fun gamelistLockPath(gamelistPath: String): String = "$gamelistPath.lock"

fun releaseLockFile(lockPath: String) {
    deleteFileQuietly(lockPath)
}

suspend fun <T> withFileLockCancellable(
    lockPath: String,
    isCancelled: () -> Boolean,
    onLockAcquired: ((release: () -> Unit) -> Unit)? = null,
    block: suspend () -> T,
): T {
    val lockFile = File(lockPath)
    lockFile.parentFile?.mkdirs()
    val deadline = System.currentTimeMillis() + 60_000L
    while (true) {
        if (isCancelled()) throw CancellationException()
        if (System.currentTimeMillis() >= deadline) {
            error("Timed out waiting for lock: $lockPath")
        }
        if (lockFile.createNewFile()) {
            val released = AtomicBoolean(false)
            val release = {
                if (released.compareAndSet(false, true)) {
                    try {
                        lockFile.delete()
                    } catch (_: Exception) {
                    }
                }
            }
            lockFile.writeText("${ProcessHandle.current().pid()}\n")
            onLockAcquired?.invoke(release)
            try {
                if (isCancelled()) throw CancellationException()
                return block()
            } finally {
                release()
            }
        }
        delay(50L)
    }
}

fun ensureParentDir(path: String) {
    File(path).parentFile?.mkdirs()
}

fun deleteFileQuietly(path: String) {
    try {
        Files.deleteIfExists(File(path).toPath())
    } catch (_: Exception) {
    }
}
