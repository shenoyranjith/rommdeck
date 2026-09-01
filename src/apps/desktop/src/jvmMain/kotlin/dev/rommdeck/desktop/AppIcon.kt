package dev.rommdeck.desktop

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.painter.BitmapPainter
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.graphics.toComposeImageBitmap
import org.jetbrains.skia.Image

private const val ICON_RESOURCE = "/icons/app-icon-256.png"

private object AppIconResources

fun loadAppIconBitmap(): ImageBitmap {
    val bytes = checkNotNull(AppIconResources::class.java.getResourceAsStream(ICON_RESOURCE)) {
        "Missing $ICON_RESOURCE — run :apps:desktop:compileKotlinJvm"
    }.readBytes()
    return Image.makeFromEncoded(bytes).toComposeImageBitmap()
}

@Composable
fun rememberAppIconPainter(): Painter = remember { BitmapPainter(loadAppIconBitmap()) }
