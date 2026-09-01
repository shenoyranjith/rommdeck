package dev.rommdeck.shared.io

import io.ktor.utils.io.ByteReadChannel

actual fun readClasspathResource(name: String): String? = null

actual fun joinPath(first: String, vararg more: String): String =
    listOf(first, *more).joinToString("/") { it.trimEnd('/') }

actual fun readUtf8File(path: String): String? = null

actual fun writeUtf8File(path: String, content: String) {
    error("Android file I/O not implemented")
}

actual fun formatUtcYmdT000000(epochMillis: Long): String {
    error("Android date formatting not implemented")
}

actual fun fileExists(path: String): Boolean = false

actual fun fileSizeBytes(path: String): Long = 0

actual fun fileMtimeIso(path: String): String = ""

actual fun md5Hex(path: String): String = error("Android hashing not implemented")

actual fun readFileBytes(path: String): ByteArray = error("Android file I/O not implemented")

actual fun hostName(): String = "android"

actual fun currentTimeIso(): String = ""

actual suspend fun writeFileFromChannel(
    path: String,
    channel: ByteReadChannel,
    onProgress: (bytesWritten: Long) -> Unit,
) {
    error("Android file I/O not implemented")
}
