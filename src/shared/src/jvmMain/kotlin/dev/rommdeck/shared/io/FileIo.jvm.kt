package dev.rommdeck.shared.io

import io.ktor.utils.io.ByteReadChannel
import io.ktor.utils.io.jvm.javaio.toInputStream
import java.io.File
import java.net.InetAddress
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.FileSystemException
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import kotlin.coroutines.coroutineContext
import kotlinx.coroutines.ensureActive
import java.security.MessageDigest
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

actual fun readClasspathResource(name: String): String? {
    val stream = Thread.currentThread().contextClassLoader.getResourceAsStream(name)
        ?: object {}.javaClass.getResourceAsStream("/$name")
        ?: return null
    return stream.bufferedReader().use { it.readText() }
}

actual fun joinPath(first: String, vararg more: String): String =
    Path.of(first, *more).toString()

actual fun readUtf8File(path: String): String? {
    val file = File(path)
    if (!file.isFile) return null
    return file.readText()
}

actual fun writeUtf8File(path: String, content: String) {
    val file = File(path)
    file.parentFile?.mkdirs()
    file.writeText(content)
}

actual fun formatUtcYmdT000000(epochMillis: Long): String {
    val date = Instant.ofEpochMilli(epochMillis).atZone(ZoneOffset.UTC).toLocalDate()
    return date.format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "T000000"
}

actual fun fileExists(path: String): Boolean = File(path).isFile

actual fun fileSizeBytes(path: String): Long = File(path).length()

actual fun fileMtimeIso(path: String): String =
    Instant.ofEpochMilli(File(path).lastModified()).toString()

actual fun md5Hex(path: String): String {
    val digest = MessageDigest.getInstance("MD5")
    File(path).inputStream().use { input ->
        val buf = ByteArray(64 * 1024)
        while (true) {
            val n = input.read(buf)
            if (n <= 0) break
            digest.update(buf, 0, n)
        }
    }
    return digest.digest().joinToString("") { b -> "%02x".format(b) }
}

actual fun readFileBytes(path: String): ByteArray = File(path).readBytes()

actual fun hostName(): String =
    try {
        InetAddress.getLocalHost().hostName
    } catch (_: Exception) {
        System.getenv("HOSTNAME") ?: "rommdeck"
    }

actual fun currentTimeIso(): String = Instant.now().toString()

actual suspend fun writeFileFromChannel(
    path: String,
    channel: ByteReadChannel,
    onProgress: (bytesWritten: Long) -> Unit,
) {
    val dest = File(path)
    dest.parentFile?.mkdirs()
    val part = File("${path}.part")
    try {
        part.outputStream().use { out ->
            var total = 0L
            channel.toInputStream().use { input ->
                val buffer = ByteArray(64 * 1024)
                while (true) {
                    val read = input.read(buffer)
                    if (read <= 0) break
                    coroutineContext.ensureActive()
                    out.write(buffer, 0, read)
                    total += read
                    onProgress(total)
                }
            }
        }
        finalizePartFile(part, dest)
    } finally {
        channel.cancel(null)
    }
}

private fun finalizePartFile(part: File, dest: File) {
    try {
        Files.move(part.toPath(), dest.toPath(), StandardCopyOption.REPLACE_EXISTING)
    } catch (_: AtomicMoveNotSupportedException) {
        copyPartToDest(part, dest)
    } catch (e: FileSystemException) {
        if (e.message?.contains("cross-device", ignoreCase = true) == true) {
            copyPartToDest(part, dest)
        } else {
            throw e
        }
    }
}

private fun copyPartToDest(part: File, dest: File) {
    Files.copy(part.toPath(), dest.toPath(), StandardCopyOption.REPLACE_EXISTING)
    Files.deleteIfExists(part.toPath())
}
