package dev.rommdeck.shared.paths

import java.nio.file.Files
import java.nio.file.Path

/**
 * Resolves the install prefix for packaged desktop builds.
 *
 * Expected layout:
 * ```
 * $ROMMDECK_APP_ROOT/
 *   bin/RommDeck
 *   lib/...
 *   syncd/
 *     bin/rommdeck-syncd
 *     lib/...
 * ```
 */
object AppInstallLayout {
    private const val SYNCD_DIR = "syncd"
    private const val SYNCD_UNIX = "rommdeck-syncd"
    private const val SYNCD_WINDOWS = "rommdeck-syncd.bat"

    /** Explicit install root from env, AppImage, or jpackage layout detection. */
    fun appRoot(): Path? {
        envPath("ROMMDECK_APP_ROOT")?.let { root ->
            if (Files.isDirectory(root)) return root
        }

        envPath("APPDIR")?.let { appDir ->
            // AppImage mount: AppRun may place the Compose tree under rommdeck/ or at APPDIR itself.
            listOf(appDir.resolve("rommdeck"), appDir)
                .firstOrNull { looksLikeAppRoot(it) }
                ?.let { return it }
        }

        return detectJpackageAppRoot()
    }

    /** Bundled sidecar tree under the app root, or via ROMMDECK_SYNCD_DIST. */
    fun bundledSyncdDist(): Path? {
        envPath("ROMMDECK_SYNCD_DIST")?.let { path ->
            if (isSyncdDist(path)) return path
        }

        appRoot()?.resolve(SYNCD_DIR)?.let { path ->
            if (isSyncdDist(path)) return path
        }

        // Compose appResourcesRootDir → compose.application.resources.dir/syncd
        System.getProperty("compose.application.resources.dir")?.takeIf { it.isNotBlank() }?.let { dir ->
            val path = Path.of(dir, SYNCD_DIR)
            if (isSyncdDist(path)) return path
        }

        return null
    }

    fun isSyncdDist(dir: Path): Boolean {
        if (!Files.isDirectory(dir)) return false
        return Files.isRegularFile(sidecarExec(dir))
    }

    fun sidecarExec(installDir: Path): Path {
        val windows = installDir.resolve("bin").resolve(SYNCD_WINDOWS)
        val unix = installDir.resolve("bin").resolve(SYNCD_UNIX)
        return if (isWindows()) windows else unix
    }

    internal fun looksLikeAppRoot(root: Path): Boolean {
        if (!Files.isDirectory(root)) return false
        val hasLib = Files.isDirectory(root.resolve("lib"))
        val hasBin = Files.isDirectory(root.resolve("bin"))
        val hasSyncd = isSyncdDist(root.resolve(SYNCD_DIR))
        return hasLib && (hasBin || hasSyncd)
    }

    /**
     * jpackage / Compose layout: java.home is `$APP/lib/runtime`.
     */
    internal fun detectJpackageAppRoot(
        javaHome: Path = Path.of(System.getProperty("java.home")).toAbsolutePath().normalize(),
    ): Path? {
        if (javaHome.fileName.toString() != "runtime") return null
        val lib = javaHome.parent ?: return null
        if (lib.fileName.toString() != "lib") return null
        val root = lib.parent ?: return null
        return root.takeIf { looksLikeAppRoot(it) }
    }

    private fun envPath(name: String): Path? =
        System.getenv(name)?.takeIf { it.isNotBlank() }?.let { Path.of(it).toAbsolutePath().normalize() }

    private fun isWindows(): Boolean =
        System.getProperty("os.name").lowercase().contains("win")
}
