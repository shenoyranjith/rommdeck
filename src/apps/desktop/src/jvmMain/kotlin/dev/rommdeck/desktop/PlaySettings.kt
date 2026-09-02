package dev.rommdeck.desktop

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.rommdeck.shared.config.PlayTargetConfig
import dev.rommdeck.shared.config.RommDeckConfig
import dev.rommdeck.shared.config.createConfigRepository
import dev.rommdeck.shared.play.PathSource
import dev.rommdeck.shared.play.ResolvedPlayPaths
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val PlayTargetSaveDebounceMs = 400L

@Composable
fun PlaySettings(
    config: RommDeckConfig,
    paths: ResolvedPlayPaths,
    onConfigChange: (RommDeckConfig) -> Unit,
) {
    val c = Rd
    val repo = remember { createConfigRepository() }
    val scope = rememberCoroutineScope()
    var saveJob by remember { mutableStateOf<Job?>(null) }
    val playTarget = config.playTarget

    fun persistPlayTargetDebounced(nextPlayTarget: PlayTargetConfig) {
        val next = config.copy(playTarget = nextPlayTarget)
        onConfigChange(next)
        saveJob?.cancel()
        saveJob = scope.launch {
            delay(PlayTargetSaveDebounceMs)
            withContext(Dispatchers.IO) { repo.save(next) }
        }
    }

    RdPanel {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    "Paths",
                    color = c.text,
                    style = RdType.body.copy(fontWeight = FontWeight.SemiBold),
                )
                Text(
                    buildAnnotatedString {
                        append("ES-DE is used when paths are left empty. On Linux, RetroDECK paths apply when ")
                        withStyle(SpanStyle(fontFamily = FontFamily.Monospace, fontSize = 11.sp)) {
                            append("retrodeck.json")
                        }
                        append(" is found (or you set the config file path). Folder fields empty = auto-detect.")
                    },
                    color = c.muted,
                    style = RdType.small.copy(lineHeight = 18.sp),
                )
            }

            RdField(
                value = playTarget.configPath,
                onValueChange = { persistPlayTargetDebounced(playTarget.copy(configPath = it)) },
                label = "Config file",
                placeholder = "Auto-detect",
            )
            RdField(
                value = playTarget.romsPath,
                onValueChange = { persistPlayTargetDebounced(playTarget.copy(romsPath = it)) },
                label = "ROMs folder",
                placeholder = "Auto-detect",
            )
            RdField(
                value = playTarget.savesPath,
                onValueChange = { persistPlayTargetDebounced(playTarget.copy(savesPath = it)) },
                label = "Saves folder",
                placeholder = "Auto-detect",
            )
            RdField(
                value = playTarget.statesPath,
                onValueChange = { persistPlayTargetDebounced(playTarget.copy(statesPath = it)) },
                label = "States folder",
                placeholder = "Auto-detect",
            )

            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    "Resolved paths",
                    color = c.text,
                    style = RdType.body.copy(fontWeight = FontWeight.SemiBold),
                )
                Text(
                    buildString {
                        appendLine("Source: ${pathSourceLabel(paths.source)}")
                        appendLine("ROMs: ${pathOrDash(paths.romsPath)}")
                        appendLine("Saves: ${pathOrDash(paths.savesPath)}")
                        append("States: ${pathOrDash(paths.statesPath)}")
                    },
                    color = c.muted,
                    style = RdType.mono.copy(fontSize = 11.sp, lineHeight = 18.sp),
                )
            }

            Column(Modifier.fillMaxWidth()) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(c.line),
                )
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            "Sync metadata on download",
                            color = c.text,
                            style = RdType.body.copy(fontWeight = FontWeight.SemiBold),
                        )
                        Text(
                            "Update gamelist.xml and download cover art from RomM after each ROM lands on disk.",
                            color = c.muted,
                            style = RdType.small,
                        )
                    }
                    RdSwitch(
                        checked = playTarget.syncMetadataOnDownload,
                        onCheckedChange = { enabled ->
                            val next = config.copy(
                                playTarget = playTarget.copy(syncMetadataOnDownload = enabled),
                            )
                            onConfigChange(next)
                            scope.launch {
                                withContext(Dispatchers.IO) { repo.save(next) }
                            }
                        },
                    )
                }
            }
        }
    }
}

private fun pathOrDash(path: String): String = path.ifBlank { "—" }

private fun pathSourceLabel(source: PathSource): String = when (source) {
    PathSource.RETRODECK_AUTO -> "retrodeck"
    PathSource.ESDE_AUTO -> "esde"
    PathSource.MANUAL -> "override"
    PathSource.UNCONFIGURED -> "unconfigured"
}
