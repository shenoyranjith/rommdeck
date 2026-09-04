package dev.rommdeck.desktop

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.rommdeck.shared.platform.PlatformMapRow
import dev.rommdeck.shared.platform.PlatformMapSource
import dev.rommdeck.shared.platform.bundledPlatformMap
import dev.rommdeck.shared.platform.buildPlatformMapRows
import dev.rommdeck.shared.platform.overridesFromRows
import dev.rommdeck.shared.platform.platformMapSourceLabel
import dev.rommdeck.shared.platform.rowSource
import kotlinx.coroutines.launch

private val PlatformMapTableHeight = 280.dp

@Composable
fun PlatformMapEditor(
    overrides: Map<String, String>,
    onSave: suspend (Map<String, String>) -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = Rd
    val scope = rememberCoroutineScope()
    val bundled = remember { bundledPlatformMap() }
    var rows by remember(overrides) { mutableStateOf(buildPlatformMapRows(bundled, overrides)) }
    var filter by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }

    val visibleRows = remember(rows, filter) {
        val query = filter.trim().lowercase()
        if (query.isEmpty()) {
            rows
        } else {
            rows.filter {
                it.rommSlug.lowercase().contains(query) || it.esdeFolder.lowercase().contains(query)
            }
        }
    }

    Column(
        modifier.fillMaxWidth(),
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .border(1.dp, c.line, RectangleShape)
                .background(c.bg0.copy(alpha = 0.5f))
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                "RomM platform slug → library folder. Edit folders that differ from the bundled default; unchanged rows are not saved as overrides.",
                color = c.muted,
                style = RdType.small,
            )
            RdField(
                value = filter,
                onValueChange = { filter = it },
                placeholder = "Filter by slug or folder…",
            )
        }

        Box(
            Modifier
                .fillMaxWidth()
                .height(PlatformMapTableHeight)
                .border(1.dp, c.line, RectangleShape)
                .background(c.bg0.copy(alpha = 0.35f)),
        ) {
            val scrollState = rememberScrollState()
            Column(
                Modifier
                    .fillMaxSize()
                    .padding(end = RdScrollbarThickness + RdScrollbarGap)
                    .verticalScroll(scrollState),
            ) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .background(c.bg0)
                        .border(1.dp, c.line, RectangleShape)
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                ) {
                    Text("RomM slug", color = c.muted, style = RdType.micro, modifier = Modifier.weight(1.1f))
                    Text("Library folder", color = c.muted, style = RdType.micro, modifier = Modifier.weight(1.1f))
                    Text("Source", color = c.muted, style = RdType.micro, modifier = Modifier.weight(0.8f))
                }
                if (visibleRows.isEmpty()) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .padding(vertical = 32.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("No mappings match your filter.", color = c.muted, style = RdType.small)
                    }
                } else {
                    visibleRows.forEach { row ->
                        PlatformMapEditorRow(
                            row = row,
                            onFolderChange = { nextFolder ->
                                rows = rows.map { current ->
                                    if (current.rommSlug == row.rommSlug) {
                                        current.copy(
                                            esdeFolder = nextFolder,
                                            source = rowSource(row.rommSlug, nextFolder, bundled),
                                        )
                                    } else {
                                        current
                                    }
                                }
                            },
                        )
                    }
                }
            }
            RdVerticalScrollbar(
                state = scrollState,
                modifier = Modifier.align(Alignment.CenterEnd),
            )
        }

        Row(
            Modifier
                .fillMaxWidth()
                .border(1.dp, c.line, RectangleShape)
                .background(c.bg0.copy(alpha = 0.5f))
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            RdButton(
                onClick = {
                    saving = true
                    scope.launch {
                        try {
                            onSave(overridesFromRows(rows, bundled))
                        } finally {
                            saving = false
                        }
                    }
                },
                primary = true,
                enabled = !saving,
            ) {
                Text(if (saving) "Saving…" else "Save", fontWeight = FontWeight.SemiBold)
            }
            RdButton(onClick = onCancel, enabled = !saving) {
                Text("Cancel")
            }
        }
    }
}

@Composable
private fun PlatformMapEditorRow(
    row: PlatformMapRow,
    onFolderChange: (String) -> Unit,
) {
    val c = Rd
    Row(
        Modifier
            .fillMaxWidth()
            .border(1.dp, c.line.copy(alpha = 0.7f), RectangleShape)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            row.rommSlug,
            color = c.accent,
            style = RdType.mono.copy(fontSize = 13.sp),
            modifier = Modifier.weight(1.1f),
        )
        RdField(
            value = row.esdeFolder,
            onValueChange = onFolderChange,
            textStyle = RdType.mono.copy(fontSize = 12.sp, color = c.text),
            modifier = Modifier.weight(1.1f),
        )
        Box(Modifier.weight(0.8f)) {
            Text(
                platformMapSourceLabel(row.source),
                color = when (row.source) {
                    PlatformMapSource.Override -> c.accent
                    PlatformMapSource.Default, PlatformMapSource.Identity -> c.muted
                },
                style = RdType.mono.copy(fontSize = 11.sp),
                modifier = Modifier
                    .border(
                        1.dp,
                        when (row.source) {
                            PlatformMapSource.Override -> c.accent.copy(alpha = 0.5f)
                            PlatformMapSource.Default, PlatformMapSource.Identity -> c.line
                        },
                        RectangleShape,
                    )
                    .padding(horizontal = 8.dp, vertical = 2.dp),
            )
        }
    }
}
