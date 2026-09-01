package dev.rommdeck.desktop

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.toComposeImageBitmap
import androidx.compose.ui.layout.ContentScale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.jetbrains.skia.Image as SkiaImage
import java.net.HttpURLConnection
import java.net.URI

private object RommImageCache {
    private val bitmaps = mutableMapOf<String, ImageBitmap>()

    fun get(url: String): ImageBitmap? = bitmaps[url]

    fun put(url: String, bitmap: ImageBitmap) {
        bitmaps[url] = bitmap
    }
}

private suspend fun fetchAuthenticatedAsset(url: String, apiToken: String): ByteArray? =
    withContext(Dispatchers.IO) {
        try {
            val connection = URI(url).toURL().openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.connectTimeout = 15_000
            connection.readTimeout = 15_000
            if (apiToken.isNotBlank()) {
                connection.setRequestProperty("Authorization", "Bearer $apiToken")
            }
            if (connection.responseCode !in 200..299) return@withContext null
            connection.inputStream.use { it.readBytes() }
        } catch (_: Exception) {
            null
        }
    }

@Composable
fun RommAssetImage(
    url: String?,
    apiToken: String,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Fit,
    contentAlignment: Alignment = Alignment.Center,
    fallback: @Composable () -> Unit,
) {
    var bitmap by remember(url) { mutableStateOf<ImageBitmap?>(url?.let(RommImageCache::get)) }

    LaunchedEffect(url, apiToken) {
        if (url.isNullOrBlank()) {
            bitmap = null
            return@LaunchedEffect
        }
        RommImageCache.get(url)?.let {
            bitmap = it
            return@LaunchedEffect
        }
        val loaded = fetchAuthenticatedAsset(url, apiToken)?.let { bytes ->
            SkiaImage.makeFromEncoded(bytes).toComposeImageBitmap()
        }
        if (loaded != null) {
            RommImageCache.put(url, loaded)
        }
        bitmap = loaded
    }

    if (bitmap != null) {
        Image(
            bitmap = bitmap!!,
            contentDescription = null,
            modifier = modifier,
            contentScale = contentScale,
            alignment = contentAlignment,
        )
    } else {
        Box(modifier, contentAlignment = contentAlignment) {
            fallback()
        }
    }
}
