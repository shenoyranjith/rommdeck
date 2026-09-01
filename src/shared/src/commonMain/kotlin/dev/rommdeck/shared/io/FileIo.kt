package dev.rommdeck.shared.io

import io.ktor.utils.io.ByteReadChannel

expect fun readClasspathResource(name: String): String?

expect fun joinPath(first: String, vararg more: String): String

expect fun readUtf8File(path: String): String?

expect fun writeUtf8File(path: String, content: String)

expect fun formatUtcYmdT000000(epochMillis: Long): String

expect fun fileExists(path: String): Boolean

expect fun fileSizeBytes(path: String): Long

expect fun fileMtimeIso(path: String): String

expect fun md5Hex(path: String): String

expect fun readFileBytes(path: String): ByteArray

expect fun hostName(): String

expect fun currentTimeIso(): String

expect suspend fun writeFileFromChannel(
    path: String,
    channel: ByteReadChannel,
    onProgress: (bytesWritten: Long) -> Unit = {},
)
