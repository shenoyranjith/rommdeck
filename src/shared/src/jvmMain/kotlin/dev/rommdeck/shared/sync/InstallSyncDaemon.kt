package dev.rommdeck.shared.sync

import dev.rommdeck.shared.log.log
import dev.rommdeck.shared.paths.AppInstallLayout
import dev.rommdeck.shared.paths.AppPaths
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.nio.file.attribute.PosixFilePermissions

private const val SERVICE_NAME = "rommdeck-syncd"
private const val MAC_LABEL = "dev.rommdeck.syncd"
private const val WINDOWS_TASK = "RommDeckSyncd"

actual fun isAutoSyncServiceInstalled(): Boolean = when (currentOs()) {
    DesktopOs.LINUX -> Files.isRegularFile(linuxUnitPath())
    DesktopOs.MACOS -> Files.isRegularFile(macPlistPath())
    DesktopOs.WINDOWS -> runCommand("schtasks", "/Query", "/TN", WINDOWS_TASK).ok
    DesktopOs.OTHER -> false
}

actual fun installAutoSyncService(): ServiceCommandResult {
    val dist = resolveInstallDist()
        ?: return ServiceCommandResult(
            false,
            "Could not find sidecar distribution. Packaged installs need syncd under " +
                "\$ROMMDECK_APP_ROOT/syncd; for development run ./gradlew :apps:syncd:installDist " +
                "from src/, or set ROMMDECK_SYNCD_DIST / ROMMDECK_APP_ROOT / ROMMDECK_SRC_ROOT.",
        )
    val dest = Path.of(AppPaths.dataDir(), "syncd")
    copyTree(dist, dest)
    maybeBundleRuntime(dest)
    val version = resolveSyncdDistVersion(dist.toString()).let { stamped ->
        if (stamped != "unknown") stamped
        else System.getenv("ROMMDECK_VERSION")?.takeIf { it.isNotBlank() } ?: stamped
    }
    writeSyncdInstallManifest(dest.toString(), version)
    log.info("daemon", "installed syncd", mapOf("version" to version, "path" to dest.toString()))
    val execPath = sidecarExecPath(dest)
    if (!Files.isRegularFile(execPath)) {
        return ServiceCommandResult(false, "Sidecar start script missing at $execPath")
    }
    makeExecutable(execPath)
    val wrapper = writeLauncher(execPath)
    return writeOsService(wrapper ?: execPath)
}

actual fun controlAutoSyncService(action: AutoSyncAction): ServiceCommandResult {
    if (action == AutoSyncAction.ENABLE && !isAutoSyncServiceInstalled()) {
        val installed = installAutoSyncService()
        if (!installed.ok) return installed
    }
    return when (currentOs()) {
        DesktopOs.LINUX -> controlSystemd(action)
        DesktopOs.MACOS -> controlLaunchd(action)
        DesktopOs.WINDOWS -> controlSchtasks(action)
        DesktopOs.OTHER -> ServiceCommandResult(false, "Auto-sync service is not supported on this OS")
    }
}

/** Restart the background sync daemon when config changes (no-op if not installed/running). */
fun restartSyncDaemonIfActive() {
    if (isSyncDaemonProcess()) return
    if (!isAutoSyncServiceInstalled()) return
    if (!controlAutoSyncService(AutoSyncAction.STATUS).ok) return
    log.info("daemon", "restarting sync daemon after config change")
    val result = controlAutoSyncService(AutoSyncAction.RESTART)
    if (!result.ok) {
        log.warn("daemon", "restart after config change failed", mapOf("output" to result.output))
    }
}

private fun isSyncDaemonProcess(): Boolean {
    val status = readDaemonStatus()
    return status.running && status.pid == ProcessHandle.current().pid()
}

internal fun linuxUnitPath(): Path =
    Path.of(homeDir(), ".config", "systemd", "user", "$SERVICE_NAME.service")

internal fun linuxBinPath(): Path =
    Path.of(homeDir(), ".local", "bin", SERVICE_NAME)

internal fun macPlistPath(): Path =
    Path.of(homeDir(), "Library", "LaunchAgents", "$MAC_LABEL.plist")

internal fun sidecarExecPath(installDir: Path): Path = AppInstallLayout.sidecarExec(installDir)

private fun writeOsService(execStart: Path): ServiceCommandResult = when (currentOs()) {
    DesktopOs.LINUX -> {
        val unit = linuxUnitPath()
        Files.createDirectories(unit.parent)
        Files.writeString(unit, systemdUnitText(execStart.toAbsolutePath().toString()))
        val reload = runCommand("systemctl", "--user", "daemon-reload")
        if (!reload.ok) {
            ServiceCommandResult(true, "Installed unit at $unit (daemon-reload: ${reload.output})")
        } else {
            ServiceCommandResult(true, "Installed systemd user unit at $unit")
        }
    }
    DesktopOs.MACOS -> {
        val plist = macPlistPath()
        Files.createDirectories(plist.parent)
        Files.writeString(plist, launchAgentPlist(execStart.toAbsolutePath().toString()))
        ServiceCommandResult(true, "Installed LaunchAgent at $plist")
    }
    DesktopOs.WINDOWS -> {
        val create = runCommand(
            "schtasks", "/Create", "/F",
            "/TN", WINDOWS_TASK,
            "/SC", "ONLOGON",
            "/TR", execStart.toAbsolutePath().toString(),
        )
        if (create.ok) ServiceCommandResult(true, "Installed scheduled task $WINDOWS_TASK")
        else create
    }
    DesktopOs.OTHER -> ServiceCommandResult(false, "No service installer for this OS")
}

private fun writeLauncher(execPath: Path): Path? {
    if (currentOs() == DesktopOs.WINDOWS) return null
    val bin = linuxBinPath()
    Files.createDirectories(bin.parent)
    Files.writeString(bin, unixWrapperScript(execPath.toAbsolutePath().toString()))
    makeExecutable(bin)
    return bin
}

private fun controlSystemd(action: AutoSyncAction): ServiceCommandResult {
    val args = when (action) {
        AutoSyncAction.ENABLE -> listOf("--user", "enable", "--now", "$SERVICE_NAME.service")
        AutoSyncAction.DISABLE -> listOf("--user", "disable", "--now", "$SERVICE_NAME.service")
        AutoSyncAction.RESTART -> listOf("--user", "restart", "$SERVICE_NAME.service")
        AutoSyncAction.START -> listOf("--user", "start", "$SERVICE_NAME.service")
        AutoSyncAction.STOP -> listOf("--user", "stop", "$SERVICE_NAME.service")
        AutoSyncAction.STATUS -> listOf("--user", "is-active", "$SERVICE_NAME.service")
    }
    return runCommand("systemctl", *args.toTypedArray())
}

private fun controlLaunchd(action: AutoSyncAction): ServiceCommandResult {
    val plist = macPlistPath().toString()
    return when (action) {
        AutoSyncAction.ENABLE, AutoSyncAction.START, AutoSyncAction.RESTART ->
            runCommand("launchctl", "load", "-w", plist)
        AutoSyncAction.DISABLE, AutoSyncAction.STOP ->
            runCommand("launchctl", "unload", "-w", plist)
        AutoSyncAction.STATUS ->
            runCommand("launchctl", "list", MAC_LABEL)
    }
}

private fun controlSchtasks(action: AutoSyncAction): ServiceCommandResult = when (action) {
    AutoSyncAction.ENABLE, AutoSyncAction.START -> runCommand("schtasks", "/Run", "/TN", WINDOWS_TASK)
    AutoSyncAction.DISABLE, AutoSyncAction.STOP -> runCommand("schtasks", "/End", "/TN", WINDOWS_TASK)
    AutoSyncAction.RESTART -> {
        runCommand("schtasks", "/End", "/TN", WINDOWS_TASK)
        runCommand("schtasks", "/Run", "/TN", WINDOWS_TASK)
    }
    AutoSyncAction.STATUS -> runCommand("schtasks", "/Query", "/TN", WINDOWS_TASK)
}

/**
 * Prefer packaged/bundled syncd, then Gradle build tree, then a previously copied install.
 *
 * Order:
 * 1. `ROMMDECK_SYNCD_DIST`
 * 2. `$ROMMDECK_APP_ROOT/syncd` (or AppImage / jpackage detection)
 * 3. Compose `appResources` syncd
 * 4. Gradle `:apps:syncd:installDist` under a detected source root
 * 5. Existing `$dataDir/syncd` from a prior install
 */
internal fun resolveInstallDist(): Path? {
    AppInstallLayout.bundledSyncdDist()?.let { return it }

    val existing = Path.of(AppPaths.dataDir(), "syncd")
    val root = findKotlinSrcRoot()
    if (root != null) {
        val built = buildInstallDist(root)
        if (!built.ok) {
            log.warn("daemon", "installDist failed", mapOf("error" to built.output))
        }
        val fromGradle = root.resolve("apps/syncd/build/install/rommdeck-syncd")
        if (AppInstallLayout.isSyncdDist(fromGradle)) return fromGradle
        val alt = root.resolve("apps/syncd/build/install/syncd")
        if (AppInstallLayout.isSyncdDist(alt)) return alt
    }
    if (AppInstallLayout.isSyncdDist(existing)) return existing
    return null
}

internal fun findKotlinSrcRoot(): Path? {
    System.getenv("ROMMDECK_SRC_ROOT")?.let { env ->
        val path = Path.of(env)
        if (isSrcRoot(path)) return path.toAbsolutePath()
    }
    var dir: Path? = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize()
    repeat(12) {
        val current = dir ?: return null
        if (isSrcRoot(current)) return current
        dir = current.parent
    }
    return null
}

private fun isSrcRoot(dir: Path): Boolean =
    Files.isRegularFile(dir.resolve("settings.gradle.kts")) &&
        Files.isDirectory(dir.resolve("apps").resolve("syncd"))

private fun buildInstallDist(root: Path): ServiceCommandResult {
    val wrapper = if (currentOs() == DesktopOs.WINDOWS) {
        root.resolve("gradlew.bat")
    } else {
        root.resolve("gradlew")
    }
    if (!Files.isRegularFile(wrapper)) {
        return ServiceCommandResult(false, "gradlew not found at $wrapper")
    }
    val command = if (currentOs() == DesktopOs.WINDOWS) {
        listOf("cmd.exe", "/c", wrapper.toString(), ":apps:syncd:installDist", "--quiet")
    } else {
        listOf(wrapper.toString(), ":apps:syncd:installDist", "--quiet")
    }
    return runCommand(*command.toTypedArray(), workingDirectory = root)
}

private fun maybeBundleRuntime(syncdDest: Path) {
    val existing = syncdDest.resolve("runtime")
    if (Files.isRegularFile(existing.resolve("bin").resolve(if (currentOs() == DesktopOs.WINDOWS) "java.exe" else "java"))) {
        return
    }
    val fromApp = AppInstallLayout.appRoot()?.resolve("lib")?.resolve("runtime")
    if (fromApp != null && Files.isDirectory(fromApp)) {
        log.info("daemon", "bundling JRE for syncd", mapOf("from" to fromApp.toString()))
        copyTree(fromApp, existing)
        return
    }
}

private fun copyTree(from: Path, to: Path) {
    if (Files.exists(to)) to.toFile().deleteRecursively()
    Files.walk(from).use { stream ->
        stream.forEach { src ->
            val dest = to.resolve(from.relativize(src).toString())
            if (Files.isDirectory(src)) {
                Files.createDirectories(dest)
            } else {
                Files.createDirectories(dest.parent)
                Files.copy(src, dest, StandardCopyOption.REPLACE_EXISTING)
            }
        }
    }
}

private fun makeExecutable(path: Path) {
    try {
        Files.setPosixFilePermissions(path, PosixFilePermissions.fromString("rwxr-xr-x"))
    } catch (_: Exception) {
    }
}

private fun runCommand(
    vararg args: String,
    workingDirectory: Path? = null,
): ServiceCommandResult {
    return try {
        val builder = ProcessBuilder(*args).redirectErrorStream(true)
        if (workingDirectory != null) builder.directory(workingDirectory.toFile())
        val proc = builder.start()
        val output = proc.inputStream.bufferedReader().readText().trim()
        val code = proc.waitFor()
        ServiceCommandResult(code == 0, output)
    } catch (e: Exception) {
        ServiceCommandResult(false, e.message ?: e.toString())
    }
}

private fun homeDir(): String =
    System.getenv("HOME") ?: System.getProperty("user.home")

internal enum class DesktopOs { LINUX, MACOS, WINDOWS, OTHER }

internal fun currentOs(): DesktopOs {
    val name = System.getProperty("os.name").lowercase()
    return when {
        name.contains("win") -> DesktopOs.WINDOWS
        name.contains("mac") -> DesktopOs.MACOS
        name.contains("linux") -> DesktopOs.LINUX
        else -> DesktopOs.OTHER
    }
}
