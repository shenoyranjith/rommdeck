package dev.rommdeck.shared.esde

import java.io.File
import java.nio.file.Files
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.delay

fun gamelistLockPath(gamelistPath: String): String = "$gamelistPath.lock"

suspend fun <T> withFileLock(
    lockPath: String,
    block: suspend () -> T,
): T {
    val lockFile = File(lockPath)
    lockFile.parentFile?.mkdirs()
    val deadline = System.currentTimeMillis() + 60_000L
    while (true) {
        if (System.currentTimeMillis() >= deadline) {
            error("Timed out waiting for lock: $lockPath")
        }
        if (lockFile.createNewFile()) {
            try {
                lockFile.writeText("${ProcessHandle.current().pid()}\n")
                return block()
            } finally {
                try {
                    lockFile.delete()
                } catch (_: Exception) {
                }
            }
        }
        delay(50L)
    }
}

suspend fun <T> withFileLockCancellable(
    lockPath: String,
    isCancelled: () -> Boolean,
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
            try {
                lockFile.writeText("${ProcessHandle.current().pid()}\n")
                if (isCancelled()) throw CancellationException()
                return block()
            } finally {
                try {
                    lockFile.delete()
                } catch (_: Exception) {
                }
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
