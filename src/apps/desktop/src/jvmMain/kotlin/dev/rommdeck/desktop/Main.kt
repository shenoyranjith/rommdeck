package dev.rommdeck.desktop

import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import androidx.compose.ui.window.rememberWindowState
import java.awt.Toolkit

private const val BASE_WIDTH = 1280f
private const val BASE_HEIGHT = 800f

fun main() = application {
    // AppTheme magnifies content by uiScale(), so the window has to grow with it
    // or the layout loses the room it was designed against.
    val scale = uiScale()
    val screen = try {
        Toolkit.getDefaultToolkit().screenSize
    } catch (_: Exception) {
        null
    }
    val width = (BASE_WIDTH * scale).coerceAtMost((screen?.width ?: Int.MAX_VALUE).toFloat())
    val height = (BASE_HEIGHT * scale).coerceAtMost((screen?.height ?: Int.MAX_VALUE).toFloat())

    Window(
        onCloseRequest = ::exitApplication,
        title = "RommDeck",
        icon = rememberAppIconPainter(),
        state = rememberWindowState(width = width.dp, height = height.dp),
    ) {
        AppRoot()
    }
}
