package dev.rommdeck.shared.download

import dev.rommdeck.shared.io.md5Hex
import java.io.File
import java.security.MessageDigest

data class RomFileHashResult(
    val sha1: String,
    /** False when RomM did not provide a hash to compare against. */
    val verified: Boolean,
)

fun verifyRomFileHash(path: String, expected: ExpectedRomHashes): RomFileHashResult {
    val wantSha1 = expected.sha1?.trim()?.lowercase()?.takeIf { it.isNotEmpty() }
    val wantMd5 = expected.md5?.trim()?.lowercase()?.takeIf { it.isNotEmpty() }

    if (wantSha1 == null && wantMd5 == null) {
        return RomFileHashResult(sha1 = sha1Hex(path), verified = false)
    }

    if (wantSha1 != null) {
        val sha1 = sha1Hex(path).lowercase()
        if (sha1 != wantSha1) {
            error("SHA-1 mismatch (expected $wantSha1, got $sha1)")
        }
        return RomFileHashResult(sha1 = sha1, verified = true)
    }

    val md5 = md5Hex(path).lowercase()
    if (md5 != wantMd5) {
        error("MD5 mismatch (expected $wantMd5, got $md5)")
    }
    return RomFileHashResult(sha1 = sha1Hex(path), verified = true)
}

private fun sha1Hex(path: String): String {
    val digest = MessageDigest.getInstance("SHA-1")
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
