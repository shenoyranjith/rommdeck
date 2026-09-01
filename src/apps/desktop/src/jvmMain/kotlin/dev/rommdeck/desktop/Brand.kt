package dev.rommdeck.desktop

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val FRAME = listOf(
    16f to 3f, 84f to 3f, 97f to 16f, 97f to 84f,
    84f to 97f, 16f to 97f, 3f to 84f, 3f to 16f,
)

/** Electron SVG uses 2.75; sidebar reads better slightly heavier. */
private const val FRAME_STROKE = 3.75f

private fun framePath(sx: Float, sy: Float): Path = Path().apply {
    val first = FRAME.first()
    moveTo(first.first * sx, first.second * sy)
    FRAME.drop(1).forEach { lineTo(it.first * sx, it.second * sy) }
    close()
}

@Composable
fun BrandMark(markSize: Dp = 128.dp, accent: Color) {
    Canvas(Modifier.size(markSize)) {
        val sx = size.width / 100f
        val sy = size.height / 100f
        val path = framePath(sx, sy)
        val center = Offset(size.width / 2f, size.height / 2f)

        drawPath(path, Color(0xFF050505))

        clipPath(path) {
            var x = 0f
            while (x < size.width) {
                drawLine(accent.copy(alpha = 0.16f), Offset(x, 0f), Offset(x, size.height), 0.65f * sx)
                x += 9f * sx
            }
            var y = 0f
            while (y < size.height) {
                drawLine(accent.copy(alpha = 0.16f), Offset(0f, y), Offset(size.width, y), 0.65f * sy)
                y += 9f * sy
            }

            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(accent.copy(alpha = 0.12f), accent.copy(alpha = 0f)),
                    center = center,
                    radius = size.minDimension * 0.55f,
                ),
                radius = size.minDimension * 0.55f,
                center = center,
            )
        }

        drawNeonStroke(path, accent, FRAME_STROKE * sx, spread = 1.35f)
        drawPath(
            path,
            accent,
            style = Stroke(width = FRAME_STROKE * sx, join = StrokeJoin.Miter),
        )
    }
}

@Composable
fun BrandMarkWithLetters(markSize: Dp = 128.dp, accent: Color) {
    Box(Modifier.size(markSize), contentAlignment = Alignment.Center) {
        BrandMark(markSize, accent)
        NeonRdText(
            accent = accent,
            fontSize = (markSize.value * 0.48f).sp,
            letterSpacing = 2.5.sp,
        )
    }
}

@Composable
private fun NeonRdText(accent: Color, fontSize: androidx.compose.ui.unit.TextUnit, letterSpacing: androidx.compose.ui.unit.TextUnit) {
    val base = TextStyle(
        fontFamily = plexSans,
        fontWeight = FontWeight.Bold,
        fontSize = fontSize,
        letterSpacing = letterSpacing,
    )
    Box(contentAlignment = Alignment.Center) {
        listOf(
            20f to 0.14f,
            14f to 0.22f,
            9f to 0.32f,
            5f to 0.48f,
        ).forEach { (blur, alpha) ->
            Text(
                "RD",
                color = accent.copy(alpha = alpha),
                style = base.copy(shadow = Shadow(accent.copy(alpha = alpha), Offset.Zero, blur)),
            )
        }
        Text("RD", color = accent, style = base)
    }
}

/** Soft neon bloom around a stroked path (frame or icon outline). */
private fun DrawScope.drawNeonStroke(path: Path, accent: Color, strokeWidth: Float, spread: Float = 1f) {
    listOf(
        strokeWidth + 18f * spread to 0.07f,
        strokeWidth + 12f * spread to 0.11f,
        strokeWidth + 7f * spread to 0.17f,
        strokeWidth + 3.5f * spread to 0.28f,
    ).forEach { (width, alpha) ->
        drawPath(
            path,
            accent.copy(alpha = alpha),
            style = Stroke(width = width, join = StrokeJoin.Miter),
        )
    }
}

enum class RdIconKind {
    LIBRARY, DOWNLOADS, SYNC, SETTINGS, SEARCH, REFRESH,
    DATABASE, CHECK, CLOCK, DRIVE, WARN,
}

@Composable
fun RdIcon(kind: RdIconKind, tint: Color, iconSize: Dp = 24.dp, stroke: Float = 2.15f) {
    Canvas(Modifier.size(iconSize)) {
        val sc = size.minDimension / 24f
        scale(sc, sc, Offset.Zero) {
            val s = Stroke(width = stroke, cap = StrokeCap.Round, join = StrokeJoin.Round)
            when (kind) {
                RdIconKind.LIBRARY -> drawGamepad(tint, s)
                RdIconKind.DOWNLOADS -> drawDownload(tint, s)
                RdIconKind.SYNC, RdIconKind.REFRESH -> drawRefresh(tint, s)
                RdIconKind.SETTINGS -> drawSettings(tint, s)
                RdIconKind.SEARCH -> drawSearch(tint, s)
                RdIconKind.DATABASE -> drawDatabase(tint, s)
                RdIconKind.CHECK -> drawCheck(tint, s)
                RdIconKind.CLOCK -> drawClock(tint, s)
                RdIconKind.DRIVE -> drawDrive(tint, s)
                RdIconKind.WARN -> drawWarn(tint, s)
            }
        }
    }
}

private fun DrawScope.drawGamepad(tint: Color, s: Stroke) {
    val body = Path().apply {
        moveTo(6.68f, 5f)
        lineTo(17.32f, 5f)
        lineTo(21.3f, 8.6f)
        lineTo(21.3f, 13.4f)
        lineTo(16f, 16f)
        lineTo(14.5f, 16f)
        lineTo(14.5f, 18.5f)
        lineTo(9.5f, 18.5f)
        lineTo(9.5f, 16f)
        lineTo(8f, 16f)
        lineTo(2.7f, 13.4f)
        lineTo(2.7f, 8.6f)
        close()
    }
    drawPath(body, tint, style = s)
    drawLine(tint, Offset(6f, 11f), Offset(10f, 11f), s.width, StrokeCap.Round)
    drawLine(tint, Offset(8f, 9f), Offset(8f, 13f), s.width, StrokeCap.Round)
    drawCircle(tint, 0.7f, Offset(15f, 12f))
    drawCircle(tint, 0.7f, Offset(18f, 12f))
}

private fun DrawScope.drawDownload(tint: Color, s: Stroke) {
    drawLine(tint, Offset(12f, 3f), Offset(12f, 15f), s.width, StrokeCap.Round)
    drawLine(tint, Offset(7f, 10f), Offset(12f, 15f), s.width, StrokeCap.Round)
    drawLine(tint, Offset(17f, 10f), Offset(12f, 15f), s.width, StrokeCap.Round)
    val tray = Path().apply {
        moveTo(21f, 15f)
        lineTo(21f, 19f)
        lineTo(3f, 19f)
        lineTo(3f, 15f)
    }
    drawPath(tray, tint, style = s)
}

private fun DrawScope.drawRefresh(tint: Color, s: Stroke) {
    // RefreshCw-style circular arrow (Lucide / Electron IconRefresh).
    drawArc(tint, 135f, 270f, false, style = s, topLeft = Offset(4f, 4f), size = Size(16f, 16f))
    drawLine(tint, Offset(12f, 4f), Offset(12f, 9f), s.width, StrokeCap.Round)
    drawLine(tint, Offset(12f, 4f), Offset(16f, 7f), s.width, StrokeCap.Round)
}

private fun DrawScope.drawSettings(tint: Color, s: Stroke) {
    drawCircle(tint, 3.2f, Offset(12f, 12f), style = s)
    val teeth = listOf(0f, 60f, 120f, 180f, 240f, 300f)
    teeth.forEach { deg ->
        val rad = Math.toRadians(deg.toDouble())
        val inner = 6.2f
        val outer = 9.4f
        val cx = 12f + kotlin.math.cos(rad).toFloat() * inner
        val cy = 12f + kotlin.math.sin(rad).toFloat() * inner
        val ox = 12f + kotlin.math.cos(rad).toFloat() * outer
        val oy = 12f + kotlin.math.sin(rad).toFloat() * outer
        drawLine(tint, Offset(cx, cy), Offset(ox, oy), s.width, StrokeCap.Round)
    }
}

private fun DrawScope.drawSearch(tint: Color, s: Stroke) {
    drawCircle(tint, 7f, Offset(11f, 11f), style = s)
    drawLine(tint, Offset(16f, 16f), Offset(21f, 21f), s.width, StrokeCap.Round)
}

private fun DrawScope.drawDatabase(tint: Color, s: Stroke) {
    drawOval(tint, topLeft = Offset(5f, 3f), size = Size(14f, 5f), style = s)
    drawLine(tint, Offset(5f, 5.5f), Offset(5f, 18.5f), s.width)
    drawLine(tint, Offset(19f, 5.5f), Offset(19f, 18.5f), s.width)
    drawArc(tint, 0f, 180f, false, style = s, topLeft = Offset(5f, 16f), size = Size(14f, 5f))
    drawArc(tint, 0f, 180f, false, style = s, topLeft = Offset(5f, 10.5f), size = Size(14f, 5f))
}

private fun DrawScope.drawCheck(tint: Color, s: Stroke) {
    val p = Path().apply {
        moveTo(5f, 12f)
        lineTo(10f, 17f)
        lineTo(19f, 7f)
    }
    drawPath(p, tint, style = s)
}

private fun DrawScope.drawClock(tint: Color, s: Stroke) {
    drawCircle(tint, 9f, Offset(12f, 12f), style = s)
    drawLine(tint, Offset(12f, 12f), Offset(12f, 7.5f), s.width, StrokeCap.Round)
    drawLine(tint, Offset(12f, 12f), Offset(16f, 12f), s.width, StrokeCap.Round)
}

private fun DrawScope.drawDrive(tint: Color, s: Stroke) {
    drawRect(tint, topLeft = Offset(3f, 7f), size = Size(18f, 10f), style = s)
    drawCircle(tint, 1.1f, Offset(17.5f, 12f))
    drawLine(tint, Offset(6f, 12f), Offset(12f, 12f), s.width, StrokeCap.Round)
}

private fun DrawScope.drawWarn(tint: Color, s: Stroke) {
    val p = Path().apply {
        moveTo(12f, 3f)
        lineTo(22f, 20f)
        lineTo(2f, 20f)
        close()
    }
    drawPath(p, tint, style = s)
    drawLine(tint, Offset(12f, 9f), Offset(12f, 14f), s.width, StrokeCap.Round)
    drawCircle(tint, 0.7f, Offset(12f, 17f))
}
