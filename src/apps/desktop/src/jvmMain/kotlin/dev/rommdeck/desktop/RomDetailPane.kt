package dev.rommdeck.desktop

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.rommdeck.shared.romm.RommPlatform
import dev.rommdeck.shared.romm.RommRom
import dev.rommdeck.shared.romm.coverUrlFor

private data class DetailBadge(val label: String, val tone: BadgeTone)

private fun RommRom.displaySizeBytes(): Long? {
    fsSizeBytes?.let { return it }
    val fromFiles = files?.sumOf { it.fileSizeBytes ?: 0L } ?: 0L
    return fromFiles.takeIf { it > 0 }
}

private fun detailBadges(onDisk: Boolean, queueStatus: DownloadJobStatus?): List<DetailBadge> {
    if (!onDisk) {
        return when (queueStatus) {
            DownloadJobStatus.QUEUED -> listOf(DetailBadge("Queued", BadgeTone.WARN))
            DownloadJobStatus.RUNNING -> listOf(DetailBadge("Downloading", BadgeTone.ACCENT))
            else -> listOf(DetailBadge("Missing", BadgeTone.WARN))
        }
    }
    return when (queueStatus) {
        DownloadJobStatus.METADATA -> listOf(
            DetailBadge("Downloaded", BadgeTone.OK),
            DetailBadge("Writing metadata", BadgeTone.ACCENT),
        )
        else -> listOf(DetailBadge("Downloaded", BadgeTone.OK))
    }
}

fun SessionDownloadQueue.activeJobStatus(romId: Int): DownloadJobStatus? =
    jobs.firstOrNull {
        it.rom.id == romId && it.status in setOf(
            DownloadJobStatus.QUEUED,
            DownloadJobStatus.RUNNING,
            DownloadJobStatus.METADATA,
        )
    }?.status

@Composable
fun RomDetailPane(
    detail: RommRom?,
    detailError: String?,
    platform: RommPlatform?,
    onDisk: Boolean,
    loading: Boolean,
    queueStatus: DownloadJobStatus?,
    canDownload: Boolean,
    rommBaseUrl: String,
    apiToken: String,
    onClose: () -> Unit,
    onDownload: (RommRom) -> Unit,
    onDelete: (RommRom) -> Unit,
) {
    val c = Rd
    Column(
        Modifier
            .width(260.dp)
            .fillMaxHeight()
            .border(1.dp, c.accent, RectangleShape)
            .background(c.bg0.copy(alpha = 0.6f)),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .border(1.dp, c.accent.copy(alpha = 0.5f), RectangleShape)
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("DETAILS", color = c.accent, style = RdType.micro)
            RdIconButton(onClick = onClose, compact = true) {
                Icon(Icons.Filled.Close, contentDescription = "Close details", modifier = Modifier.size(14.dp))
            }
        }

        Column(
            Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            when {
                detail == null && loading -> {
                    Text("Loading…", color = c.muted, style = RdType.small, modifier = Modifier.fillMaxWidth())
                }
                detail == null -> {
                    Text(
                        detailError ?: "Select a ROM",
                        color = if (detailError != null) c.danger else c.muted,
                        style = RdType.small,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                else -> {
                    val coverUrl = coverUrlFor(rommBaseUrl, detail, preferLarge = true)
                    val platformLabel = detail.platformName
                        ?: platform?.displayName
                        ?: platform?.name
                        ?: detail.platformSlug
                        ?: "—"
                    val badges = detailBadges(onDisk, queueStatus)

                    Box(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 8.dp)
                            .border(1.dp, c.line, RectangleShape)
                            .background(c.bg0, RectangleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Box(
                            Modifier
                                .fillMaxWidth(0.92f)
                                .aspectRatio(3f / 4f),
                            contentAlignment = Alignment.Center,
                        ) {
                            RommAssetImage(
                                url = coverUrl,
                                apiToken = apiToken,
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop,
                            ) {
                                RomCoverFallback(Modifier.fillMaxSize())
                            }
                        }
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            detail.name,
                            color = c.text,
                            style = RdType.body.copy(fontSize = 18.sp, fontWeight = FontWeight.SemiBold, lineHeight = 22.sp),
                        )
                        Text(platformLabel, color = c.muted, style = RdType.small)
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        badges.forEach { badge ->
                            RdBadge(badge.label, tone = badge.tone)
                        }
                    }

                    if (detailError != null) {
                        Text(
                            detailError,
                            color = c.danger,
                            style = RdType.small,
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(1.dp, c.danger.copy(alpha = 0.4f), RectangleShape)
                                .padding(horizontal = 8.dp, vertical = 6.dp),
                        )
                    }

                    val summary = detail.summary
                    if (!summary.isNullOrBlank()) {
                        Text(
                            summary.trim(),
                            color = c.text.copy(alpha = 0.9f),
                            style = RdType.small.copy(lineHeight = 20.sp),
                        )
                    } else {
                        Text(
                            "No summary from RomM.",
                            color = c.muted,
                            style = RdType.small.copy(fontStyle = FontStyle.Italic),
                        )
                    }

                    DetailField("File", detail.fsName ?: "—", showTooltipWhenTruncated = true)
                    DetailField("Size", formatBytes(detail.displaySizeBytes()))
                    if ((detail.files?.size ?: 0) > 1) {
                        DetailField("Parts", "${detail.files!!.size} files")
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (onDisk) {
                            RdButton(
                                onClick = { onDelete(detail) },
                                danger = true,
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Text("Delete local", color = LocalContentColor.current)
                            }
                        } else when (queueStatus) {
                            DownloadJobStatus.QUEUED -> {
                                RdButton(onClick = {}, enabled = false, modifier = Modifier.fillMaxWidth()) {
                                    Text("Queued")
                                }
                            }
                            DownloadJobStatus.RUNNING -> {
                                RdButton(onClick = {}, enabled = false, modifier = Modifier.fillMaxWidth()) {
                                    Text("Downloading…")
                                }
                            }
                            DownloadJobStatus.METADATA -> {
                                RdButton(onClick = {}, enabled = false, modifier = Modifier.fillMaxWidth()) {
                                    Text("Writing metadata…")
                                }
                            }
                            else -> {
                                RdButton(
                                    onClick = { onDownload(detail) },
                                    primary = true,
                                    enabled = canDownload,
                                    modifier = Modifier.fillMaxWidth(),
                                ) {
                                    Text("Download", fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DetailField(
    label: String,
    value: String,
    showTooltipWhenTruncated: Boolean = false,
) {
    val c = Rd
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            label,
            color = c.muted,
            style = RdType.small,
            modifier = Modifier.width(72.dp),
        )
        if (showTooltipWhenTruncated) {
            RdEllipsisText(
                text = value,
                color = c.text,
                style = RdType.mono.copy(fontSize = 12.sp),
                maxLines = 2,
                modifier = Modifier.weight(1f),
            )
        } else {
            Text(
                value,
                color = c.text,
                style = RdType.mono.copy(fontSize = 12.sp),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
        }
    }
}
