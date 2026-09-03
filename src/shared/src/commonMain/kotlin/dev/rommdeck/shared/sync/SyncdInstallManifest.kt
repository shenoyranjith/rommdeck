package dev.rommdeck.shared.sync

import dev.rommdeck.shared.io.currentTimeIso
import dev.rommdeck.shared.io.readUtf8File
import dev.rommdeck.shared.io.writeUtf8File
import dev.rommdeck.shared.paths.AppPaths
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Sidecar install stamp under `$dataDir/syncd/version.json` (and in packaged syncd trees). */
@Serializable
data class SyncdInstallManifest(
    val version: String,
    val installedAt: String? = null,
)

private val syncdManifestJson = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
    prettyPrint = true
}

const val SYNCD_VERSION_FILENAME = "version.json"

fun syncdInstallDir(): String = "${AppPaths.dataDir()}/syncd"

fun syncdVersionFile(installDir: String = syncdInstallDir()): String =
    "$installDir/$SYNCD_VERSION_FILENAME"

fun encodeSyncdInstallManifest(manifest: SyncdInstallManifest): String =
    syncdManifestJson.encodeToString(SyncdInstallManifest.serializer(), manifest)

fun decodeSyncdInstallManifest(text: String): SyncdInstallManifest? =
    try {
        syncdManifestJson.decodeFromString(SyncdInstallManifest.serializer(), text)
    } catch (_: Exception) {
        null
    }

fun readSyncdInstallManifest(installDir: String = syncdInstallDir()): SyncdInstallManifest? {
    val text = readUtf8File(syncdVersionFile(installDir)) ?: return null
    return decodeSyncdInstallManifest(text)
}

/** Version string only; null if syncd was never installed or has no stamp. */
fun readInstalledSyncdVersion(): String? =
    readSyncdInstallManifest()?.version?.takeIf { it.isNotBlank() }

fun writeSyncdInstallManifest(
    installDir: String,
    version: String,
    installedAt: String = currentTimeIso(),
): SyncdInstallManifest {
    val manifest = SyncdInstallManifest(version = version, installedAt = installedAt)
    writeUtf8File(syncdVersionFile(installDir), encodeSyncdInstallManifest(manifest))
    return manifest
}

fun resolveSyncdDistVersion(distDir: String): String =
    readSyncdInstallManifest(distDir)?.version?.takeIf { it.isNotBlank() } ?: "unknown"
