package dev.rommdeck.desktop

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckBox
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.IndeterminateCheckBox
import androidx.compose.material.icons.filled.ViewList
import androidx.compose.material.icons.outlined.CheckBoxOutlineBlank
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.PlainTooltip
import androidx.compose.material3.Text
import androidx.compose.material3.TooltipBox
import androidx.compose.material3.TooltipDefaults
import androidx.compose.material3.rememberTooltipState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.pointer.PointerIcon
import androidx.compose.ui.input.pointer.pointerHoverIcon
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Shared height for toolbar inputs, icon buttons, and segmented controls (Electron `h-10`). */
val RdControlHeight = 40.dp

/** Grid card body slots (Electron: 2.6em title + h-8 badge + action row). */
val RomGridTitleHeight = 36.dp
val RomGridBadgeHeight = 32.dp
val RomGridBodyPadding = 10.dp
val RomGridBodyGap = 8.dp

/** Grid card action row (shorter than toolbar `RdControlHeight`). */
val RomGridActionHeight = 32.dp

@Composable
internal fun Modifier.rdInteractive(
    enabled: Boolean = true,
    onClick: () -> Unit,
    hoverBackground: Color? = null,
): Modifier {
    val c = Rd
    val interaction = remember { MutableInteractionSource() }
    val hovered by interaction.collectIsHoveredAsState()
    val hoverBg = hoverBackground ?: c.accent.copy(alpha = 0.12f)
    return this
        .background(if (hovered && enabled) hoverBg else Color.Transparent, RectangleShape)
        .hoverable(interaction, enabled)
        .clickable(interaction, null, enabled, onClick = onClick)
        .then(if (enabled) Modifier.pointerHoverIcon(PointerIcon.Hand) else Modifier)
}

@Composable
fun RdButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    primary: Boolean = false,
    danger: Boolean = false,
    enabled: Boolean = true,
    compact: Boolean = false,
    content: @Composable RowScope.() -> Unit,
) {
    val c = Rd
    val interaction = remember { MutableInteractionSource() }
    val hovered by interaction.collectIsHoveredAsState()
    val border = when {
        danger && hovered -> c.danger.copy(alpha = 0.75f)
        danger -> c.danger.copy(alpha = 0.5f)
        primary && hovered -> c.accent.copy(alpha = 0.85f)
        primary -> c.accent
        hovered -> c.accent.copy(alpha = 0.6f)
        else -> c.line
    }
    val bg = when {
        primary -> c.accent
        danger && hovered -> c.danger.copy(alpha = 0.14f)
        hovered -> c.bg3
        else -> c.bg2
    }
    val fg = when {
        danger -> c.danger
        primary -> c.accentFg
        else -> c.text
    }
    Row(
        modifier
            .height(if (compact) RomGridActionHeight else RdControlHeight)
            .hoverable(interaction, enabled)
            .clickable(interaction, null, enabled, onClick = onClick)
            .then(if (enabled) Modifier.pointerHoverIcon(PointerIcon.Hand) else Modifier)
            .then(
                if (primary) Modifier.drawBehind {
                    drawRect(c.accent.copy(alpha = if (hovered && enabled) 0.36f else 0.28f))
                } else Modifier,
            )
            .border(1.dp, border, RectangleShape)
            .background(bg, RectangleShape)
            .padding(horizontal = if (compact) 10.dp else 12.dp)
            .then(if (enabled) Modifier else Modifier.alpha(0.4f)),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
        content = {
            CompositionLocalProvider(
                LocalContentColor provides if (enabled) fg else fg.copy(alpha = 0.4f),
            ) {
                content()
            }
        },
    )
}

@Composable
fun RdIconButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    selected: Boolean = false,
    compact: Boolean = false,
    content: @Composable () -> Unit,
) {
    val c = Rd
    val interaction = remember { MutableInteractionSource() }
    val hovered by interaction.collectIsHoveredAsState()
    val buttonSize = if (compact) 28.dp else RdControlHeight
    Box(
        modifier
            .size(buttonSize)
            .hoverable(interaction, enabled)
            .clickable(interaction, null, enabled, onClick = onClick)
            .then(if (enabled) Modifier.pointerHoverIcon(PointerIcon.Hand) else Modifier)
            .then(
                if (selected) Modifier.drawBehind {
                    drawRect(c.accent.copy(alpha = 0.28f))
                } else Modifier,
            )
            .border(1.dp, if (selected || hovered) c.accent else c.accent.copy(alpha = 0.7f), RectangleShape)
            .background(
                when {
                    selected -> c.accent
                    hovered -> c.bg3
                    else -> c.bg0
                },
                RectangleShape,
            )
            .then(if (enabled) Modifier else Modifier.alpha(0.4f)),
        contentAlignment = Alignment.Center,
    ) {
        CompositionLocalProvider(
            LocalContentColor provides if (selected) c.accentFg else c.text,
        ) {
            content()
        }
    }
}

@Composable
fun RdField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    placeholder: String = "",
    enabled: Boolean = true,
    singleLine: Boolean = true,
    textStyle: TextStyle? = null,
    visualTransformation: androidx.compose.ui.text.input.VisualTransformation =
        androidx.compose.ui.text.input.VisualTransformation.None,
    trailing: @Composable (() -> Unit)? = null,
    leading: @Composable (() -> Unit)? = null,
) {
    val c = Rd
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (label != null) {
            Text(label, color = c.muted, style = RdType.small.copy(fontSize = 12.sp))
        }
        val interaction = remember { MutableInteractionSource() }
        val focused by interaction.collectIsFocusedAsState()
        Row(
            Modifier
                .fillMaxWidth()
                .height(RdControlHeight)
                .border(1.dp, if (focused) c.accent else c.line, RectangleShape)
                .background(c.bg0, RectangleShape),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (leading != null) {
                Spacer(Modifier.width(12.dp))
                leading()
                Spacer(Modifier.width(8.dp))
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                enabled = enabled,
                singleLine = singleLine,
                interactionSource = interaction,
                cursorBrush = SolidColor(c.accent),
                textStyle = textStyle ?: RdType.field.copy(color = c.text),
                visualTransformation = visualTransformation,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .padding(
                        start = if (leading == null) 12.dp else 0.dp,
                        end = if (trailing == null) 12.dp else 0.dp,
                    ),
                decorationBox = { inner ->
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.CenterStart) {
                        if (value.isEmpty() && placeholder.isNotEmpty()) {
                            Text(placeholder, color = c.muted.copy(alpha = 0.8f), style = RdType.field)
                        }
                        inner()
                    }
                },
            )
            if (trailing != null) trailing()
        }
    }
}

@Composable
fun RdFieldSideAction(
    onClick: () -> Unit,
    enabled: Boolean = true,
    contentDescription: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
) {
    val c = Rd
    val interaction = remember { MutableInteractionSource() }
    val hovered by interaction.collectIsHoveredAsState()
    Box(
        Modifier
            .width(40.dp)
            .height(RdControlHeight)
            .drawBehind {
                drawLine(
                    color = c.line,
                    start = Offset.Zero,
                    end = Offset(0f, size.height),
                    strokeWidth = 1.dp.toPx(),
                )
            }
            .hoverable(interaction, enabled)
            .clickable(interaction, null, enabled, onClick = onClick)
            .then(if (enabled) Modifier.pointerHoverIcon(PointerIcon.Hand) else Modifier),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            icon,
            contentDescription = contentDescription,
            modifier = Modifier.size(16.dp),
            tint = when {
                !enabled -> c.muted.copy(alpha = 0.4f)
                hovered -> c.text
                else -> c.muted
            },
        )
    }
}

@Composable
fun RdPanel(
    modifier: Modifier = Modifier,
    title: String? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val c = Rd
    Column(
        modifier
            .border(1.dp, c.line, RectangleShape)
            .background(c.bg0.copy(alpha = 0.5f), RectangleShape),
    ) {
        if (title != null) {
            Text(
                title.uppercase(),
                color = c.accent,
                style = RdType.micro,
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, c.line, RectangleShape)
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            )
        }
        content()
    }
}

@Composable
fun RdPageHeader(
    title: String,
    description: String? = null,
    actions: @Composable RowScope.() -> Unit = {},
) {
    val c = Rd
    Row(
        Modifier.fillMaxWidth().padding(bottom = 16.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, color = c.text, style = RdType.title)
            if (description != null) {
                Text(description, color = c.muted, style = RdType.small, modifier = Modifier.padding(top = 4.dp))
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            actions()
        }
    }
}

@Composable
fun RdAlert(text: String, tone: AlertTone = AlertTone.OK) {
    val c = Rd
    val color = if (tone == AlertTone.OK) c.ok else c.danger
    Text(
        text,
        color = color,
        style = RdType.body,
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, color.copy(alpha = 0.4f), RectangleShape)
            .background(c.bg2, RectangleShape)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    )
}

enum class AlertTone { OK, ERR }

@Composable
fun RdNavItem(
    selected: Boolean,
    label: String,
    onClick: () -> Unit,
    icon: RdIconKind? = null,
    iconSize: Dp = 32.dp,
    compact: Boolean = false,
    badgeCount: Int? = null,
    leading: (@Composable () -> Unit)? = null,
) {
    val c = Rd
    val interaction = remember { MutableInteractionSource() }
    val hovered by interaction.collectIsHoveredAsState()
    val iconTint = if (selected) c.accent else c.text
    Row(
        Modifier
            .fillMaxWidth()
            .hoverable(interaction)
            .clickable(interaction, null, onClick = onClick)
            .pointerHoverIcon(PointerIcon.Hand)
            .background(
                when {
                    selected -> c.accent.copy(alpha = 0.15f)
                    hovered -> c.bg2.copy(alpha = 0.6f)
                    else -> Color.Transparent
                },
                RectangleShape,
            )
            .then(
                if (selected) Modifier.border(1.dp, c.accent, RectangleShape)
                else Modifier.border(1.dp, Color.Transparent, RectangleShape),
            )
            .height(if (compact) 40.dp else 52.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .width(if (selected) 6.dp else 1.dp)
                .fillMaxHeight()
                .background(if (selected) c.accent else Color.Transparent),
        )
        Row(
            Modifier
                .padding(horizontal = 12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            when {
                leading != null -> leading()
                icon != null -> RdIcon(icon, iconTint, iconSize)
            }
            Text(
                label,
                modifier = Modifier.weight(1f),
                color = if (selected) c.accent else c.text,
                style = if (compact) RdType.body.copy(fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal)
                else RdType.nav.copy(fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (badgeCount != null && badgeCount > 0) {
                RdNavBadge(badgeCount, selected)
            }
        }
    }
}

@Composable
private fun RdNavBadge(count: Int, selected: Boolean) {
    val c = Rd
    val label = if (count > 99) "99+" else count.toString()
    Box(
        Modifier
            .border(1.dp, c.accent.copy(alpha = if (selected) 1f else 0.7f), RectangleShape)
            .background(
                if (selected) c.accent.copy(alpha = 0.25f) else c.bg2,
                RectangleShape,
            )
            .padding(horizontal = 7.dp, vertical = 2.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = if (selected) c.accent else c.text,
            style = RdType.mono.copy(fontSize = 11.sp, fontWeight = FontWeight.Bold),
        )
    }
}

@Composable
fun RdSegmented(
    options: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
    fillWidth: Boolean = false,
) {
    val c = Rd
    Row(
        modifier
            .then(if (fillWidth) Modifier else Modifier.wrapContentWidth())
            .border(1.dp, c.accent.copy(alpha = 0.5f), RectangleShape)
            .padding(2.dp),
    ) {
        options.forEachIndexed { index, label ->
            val on = index == selectedIndex
            val segmentModifier = if (fillWidth) Modifier.weight(1f) else Modifier
            val interaction = remember { MutableInteractionSource() }
            val hovered by interaction.collectIsHoveredAsState()
            Box(
                segmentModifier
                    .hoverable(interaction)
                    .clickable(interaction, null) { onSelect(index) }
                    .pointerHoverIcon(PointerIcon.Hand)
                    .background(
                        when {
                            on -> c.accent
                            hovered -> c.accent.copy(alpha = 0.15f)
                            else -> Color.Transparent
                        },
                        RectangleShape,
                    )
                    .padding(horizontal = 10.dp, vertical = 4.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label,
                    color = if (on) c.accentFg else c.muted,
                    style = RdType.micro.copy(letterSpacing = 0.4.sp, fontSize = 11.sp, fontWeight = FontWeight.Medium),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
fun RdSwitch(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    enabled: Boolean = true,
) {
    val c = Rd
    val interaction = remember { MutableInteractionSource() }
    val hovered by interaction.collectIsHoveredAsState()
    Box(
        Modifier
            .width(44.dp)
            .height(24.dp)
            .hoverable(interaction, enabled)
            .clickable(interaction, null, enabled) { onCheckedChange(!checked) }
            .then(if (enabled) Modifier.pointerHoverIcon(PointerIcon.Hand) else Modifier)
            .border(
                1.dp,
                when {
                    checked && hovered -> c.accent
                    checked -> c.accent
                    hovered -> c.accent.copy(alpha = 0.6f)
                    else -> c.line
                },
                RectangleShape,
            )
            .background(
                when {
                    checked -> c.accent.copy(alpha = if (hovered) 0.28f else 0.2f)
                    hovered -> c.bg3
                    else -> c.bg0
                },
                RectangleShape,
            )
            .padding(2.dp),
        contentAlignment = if (checked) Alignment.CenterEnd else Alignment.CenterStart,
    ) {
        Box(
            Modifier
                .size(16.dp)
                .border(1.dp, if (checked) c.accent else c.line, RectangleShape)
                .background(if (checked) c.accent else c.bg2, RectangleShape),
        )
    }
}

@Composable
fun RdChoiceRow(
    options: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
) {
    val c = Rd
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEachIndexed { index, label ->
            val on = index == selectedIndex
            val interaction = remember { MutableInteractionSource() }
            val hovered by interaction.collectIsHoveredAsState()
            Box(
                Modifier
                    .hoverable(interaction)
                    .clickable(interaction, null) { onSelect(index) }
                    .pointerHoverIcon(PointerIcon.Hand)
                    .border(1.dp, if (on || hovered) c.accent else c.line, RectangleShape)
                    .background(
                        when {
                            on -> c.accent.copy(alpha = 0.15f)
                            hovered -> c.bg3
                            else -> c.bg2
                        },
                        RectangleShape,
                    )
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            ) {
                Text(
                    label,
                    color = if (on) c.accent else c.text,
                    style = RdType.small.copy(fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal),
                )
            }
        }
    }
}

@Composable
fun ScanlineOverlay(strength: Int, modifier: Modifier = Modifier) {
    val opacity = strength.coerceIn(0, 100) / 100f
    androidx.compose.foundation.Canvas(modifier.fillMaxSize()) {
        var y = 0f
        val dark = Color.Black.copy(alpha = 0.55f * opacity)
        while (y < size.height) {
            drawRect(dark, Offset(0f, y + 2f), androidx.compose.ui.geometry.Size(size.width, 1f))
            y += 3f
        }
    }
}

enum class BadgeTone { OK, WARN, ERR, ACCENT, MUTED }

enum class LibraryViewMode { GRID, LIST }

enum class SelectionState { NONE, PARTIAL, ALL }

@Composable
fun RdSelectionIcon(state: SelectionState, modifier: Modifier = Modifier) {
    val icon = when (state) {
        SelectionState.ALL -> Icons.Filled.CheckBox
        SelectionState.PARTIAL -> Icons.Filled.IndeterminateCheckBox
        SelectionState.NONE -> Icons.Outlined.CheckBoxOutlineBlank
    }
    Icon(icon, contentDescription = null, modifier = modifier.size(16.dp))
}

@Composable
fun RdViewModeToggle(
    viewMode: LibraryViewMode,
    onViewModeChange: (LibraryViewMode) -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = Rd
    Row(
        modifier
            .height(RdControlHeight)
            .border(1.dp, c.accent, RectangleShape)
            .padding(2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ViewModeButton(
            selected = viewMode == LibraryViewMode.GRID,
            onClick = { onViewModeChange(LibraryViewMode.GRID) },
        ) {
            Icon(Icons.Filled.GridView, contentDescription = "Grid view", modifier = Modifier.size(16.dp))
        }
        ViewModeButton(
            selected = viewMode == LibraryViewMode.LIST,
            onClick = { onViewModeChange(LibraryViewMode.LIST) },
        ) {
            Icon(Icons.Filled.ViewList, contentDescription = "List view", modifier = Modifier.size(16.dp))
        }
    }
}

@Composable
private fun ViewModeButton(
    selected: Boolean,
    onClick: () -> Unit,
    content: @Composable () -> Unit,
) {
    val c = Rd
    val interaction = remember { MutableInteractionSource() }
    val hovered by interaction.collectIsHoveredAsState()
    Box(
        Modifier
            .width(36.dp)
            .fillMaxHeight()
            .hoverable(interaction)
            .clickable(interaction, null, onClick = onClick)
            .pointerHoverIcon(PointerIcon.Hand)
            .background(
                when {
                    selected -> c.accent
                    hovered -> c.bg2
                    else -> Color.Transparent
                },
                RectangleShape,
            ),
        contentAlignment = Alignment.Center,
    ) {
        CompositionLocalProvider(
            LocalContentColor provides if (selected) c.accentFg else c.text,
        ) {
            content()
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RdEllipsisText(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = RdType.small,
    color: Color = Rd.text,
    maxLines: Int = 1,
) {
    var truncated by remember(text, maxLines) { mutableStateOf(false) }
    val label = @Composable {
        Text(
            text,
            modifier = modifier,
            color = color,
            style = style,
            maxLines = maxLines,
            overflow = TextOverflow.Ellipsis,
            onTextLayout = { truncated = it.hasVisualOverflow },
        )
    }
    if (truncated) {
        TooltipBox(
            positionProvider = TooltipDefaults.rememberPlainTooltipPositionProvider(),
            tooltip = {
                PlainTooltip {
                    Text(text, style = RdType.small)
                }
            },
            state = rememberTooltipState(isPersistent = true),
        ) {
            label()
        }
    } else {
        label()
    }
}

@Composable
fun RdBadge(text: String, tone: BadgeTone = BadgeTone.MUTED, modifier: Modifier = Modifier) {
    val c = Rd
    val color = when (tone) {
        BadgeTone.OK -> c.ok
        BadgeTone.WARN -> c.warn
        BadgeTone.ERR -> c.danger
        BadgeTone.ACCENT -> c.accent
        BadgeTone.MUTED -> c.muted
    }
    Text(
        text.uppercase(),
        color = color,
        style = RdType.mono.copy(fontSize = 11.sp, fontWeight = FontWeight.SemiBold),
        textAlign = TextAlign.Center,
        modifier = modifier
            .border(1.dp, color.copy(alpha = 0.4f), RectangleShape)
            .background(c.bg2, RectangleShape)
            .padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

@Composable
fun RdProgress(fraction: Float, pulse: Boolean = false) {
    val c = Rd
    val pct = fraction.coerceIn(0f, 1f)
    Box(
        Modifier
            .fillMaxWidth()
            .height(8.dp)
            .border(1.dp, c.accent.copy(alpha = 0.4f), RectangleShape)
            .background(c.bg0, RectangleShape),
    ) {
        Box(
            Modifier
                .fillMaxHeight()
                .fillMaxWidth(if (pulse && pct <= 0f) 0.35f else pct)
                .background(c.accent, RectangleShape),
        )
    }
}
