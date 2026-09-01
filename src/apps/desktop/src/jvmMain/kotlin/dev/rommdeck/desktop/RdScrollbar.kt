package dev.rommdeck.desktop

import androidx.compose.foundation.ScrollbarStyle
import androidx.compose.foundation.VerticalScrollbar
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.grid.LazyGridState
import androidx.compose.foundation.rememberScrollbarAdapter
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.unit.dp

/** Electron `::-webkit-scrollbar` width. */
val RdScrollbarThickness = 16.dp
val RdScrollbarGap = 4.dp

@Composable
fun rdScrollbarStyle(): ScrollbarStyle {
    val c = Rd
    return ScrollbarStyle(
        minimalHeight = 32.dp,
        thickness = RdScrollbarThickness,
        shape = RectangleShape,
        hoverDurationMillis = 150,
        unhoverColor = lerp(c.bg3, c.accent, 0.45f),
        hoverColor = lerp(c.bg3, c.accent, 0.70f),
    )
}

@Composable
private fun RdScrollbarTrack(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val c = Rd
    Box(
        modifier
            .width(RdScrollbarThickness)
            .background(c.bg1.copy(alpha = 0.8f)),
    ) {
        content()
    }
}

@Composable
fun RdVerticalScrollbar(
    state: LazyListState,
    modifier: Modifier = Modifier,
) {
    RdScrollbarTrack(modifier) {
        VerticalScrollbar(
            modifier = Modifier.fillMaxHeight(),
            adapter = rememberScrollbarAdapter(scrollState = state),
            style = rdScrollbarStyle(),
        )
    }
}

@Composable
fun RdVerticalScrollbar(
    state: LazyGridState,
    modifier: Modifier = Modifier,
) {
    RdScrollbarTrack(modifier) {
        VerticalScrollbar(
            modifier = Modifier.fillMaxHeight(),
            adapter = rememberScrollbarAdapter(scrollState = state),
            style = rdScrollbarStyle(),
        )
    }
}
