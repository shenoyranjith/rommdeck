package dev.rommdeck.desktop

import java.awt.GraphicsEnvironment
import java.awt.Toolkit

private const val BASE_DPI = 96f
private const val MIN_SCALE = 0.5f
private const val MAX_SCALE = 3f

private val resolvedScale: Float by lazy {
    val scale = envScale()
        ?: detectCompositorScale()
        ?: awtTransformScale()
        ?: dpiScale()
    println("RommDeck UI scale: $scale")
    scale
}

/**
 * How much to magnify every dp/sp in the UI.
 *
 * Compose Desktop draws through XWayland, which ignores a fractional Wayland
 * output scale, so on a HiDPI screen the app renders far smaller than native
 * apps next to it. Prefer `ROMMDECK_UI_SCALE` when set; otherwise we probe KDE /
 * GNOME and fall back to AWT DPI.
 */
fun uiScale(): Float = resolvedScale

private fun envScale(): Float? =
    System.getenv("ROMMDECK_UI_SCALE")
        ?.trim()
        ?.toFloatOrNull()
        ?.takeIf { it > 0f }
        ?.coerceIn(MIN_SCALE, MAX_SCALE)

/** KDE `kscreen-doctor` / GNOME text-scaling-factor — same sources as run-desktop.sh. */
private fun detectCompositorScale(): Float? {
    if (!System.getProperty("os.name", "").contains("Linux", ignoreCase = true)) return null
    probeScaleCommand(listOf("kscreen-doctor", "-o")) { output ->
        val cleaned = output.replace(Regex("\u001B\\[[0-9;]*m"), "")
        Regex("""Scale:\s*([0-9.]+)""").find(cleaned)?.groupValues?.get(1)?.toFloatOrNull()
    }?.let { return it }
    probeScaleCommand(listOf("gsettings", "get", "org.gnome.desktop.interface", "text-scaling-factor")) { output ->
        output.trim().toFloatOrNull()
    }?.let { return it }
    return null
}

private inline fun probeScaleCommand(command: List<String>, parse: (String) -> Float?): Float? =
    try {
        val proc = ProcessBuilder(command).redirectErrorStream(true).start()
        val output = proc.inputStream.bufferedReader().readText()
        proc.waitFor()
        parse(output)?.takeIf { it > 1.05f }?.coerceIn(MIN_SCALE, MAX_SCALE)
    } catch (_: Exception) {
        null
    }

private fun awtTransformScale(): Float? = try {
    GraphicsEnvironment.getLocalGraphicsEnvironment()
        .defaultScreenDevice
        .defaultConfiguration
        .defaultTransform
        .scaleX
        .toFloat()
        .takeIf { it > 1.05f }
        ?.coerceAtMost(MAX_SCALE)
} catch (_: Exception) {
    null
}

private fun dpiScale(): Float = try {
    (Toolkit.getDefaultToolkit().screenResolution / BASE_DPI).coerceIn(1f, MAX_SCALE)
} catch (_: Exception) {
    1f
}
