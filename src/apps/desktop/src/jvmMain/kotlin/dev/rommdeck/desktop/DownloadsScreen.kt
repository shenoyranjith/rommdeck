package dev.rommdeck.desktop

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun DownloadsScreen(
    queue: SessionDownloadQueue,
    onOpenLibrary: () -> Unit,
    onStartPump: () -> Unit,
) {
    val c = Rd
    val listState = rememberLazyListState()
    val hasActive = queue.queuedCount > 0 || queue.runningCount > 0

    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        RdPageHeader(
            title = "Downloads",
            description = if (hasActive) {
                "Transfers into ROM folders"
            } else {
                "View and manage your download queue."
            },
        )
        if (queue.displayJobs.isEmpty()) {
            Column(
                Modifier.weight(1f).fillMaxWidth(),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                RdIcon(RdIconKind.DOWNLOADS, c.accent, 72.dp, 1.75f)
                Text(
                    "No downloads in queue",
                    color = c.text,
                    style = RdType.nav,
                    modifier = Modifier.padding(top = 16.dp),
                )
                Row(Modifier.padding(top = 8.dp)) {
                    Text("Queue downloads from ", color = c.muted, style = RdType.small)
                    Text(
                        "Library",
                        color = c.accent,
                        style = RdType.small.copy(fontWeight = FontWeight.Medium),
                        modifier = Modifier.rdInteractive(onClick = onOpenLibrary),
                    )
                }
            }
        } else {
            Row(
                Modifier
                    .fillMaxWidth()
                    .border(1.dp, c.accent.copy(alpha = 0.4f), RectangleShape)
                    .background(c.bg0.copy(alpha = 0.6f))
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                RdIcon(RdIconKind.DOWNLOADS, c.accent, 16.dp)
                Text(
                    buildString {
                        if (queue.runningCount > 0) append("${queue.runningCount} running")
                        if (queue.queuedCount > 0) {
                            if (isNotEmpty()) append(" · ")
                            append("${queue.queuedCount} queued")
                        }
                        if (queue.failedCount > 0) {
                            if (isNotEmpty()) append(" · ")
                            append("${queue.failedCount} failed")
                        }
                    },
                    color = c.accent,
                    style = RdType.mono.copy(fontSize = 12.sp),
                    modifier = Modifier.weight(1f),
                )
                if (queue.failedCount > 0) {
                    RdButton(
                        onClick = {
                            if (queue.retryAllFailed() > 0) onStartPump()
                        },
                        compact = true,
                    ) {
                        Text("Retry all", style = RdType.small)
                    }
                    RdButton(onClick = { queue.removeAllFailed() }, compact = true) {
                        Text("Remove all", style = RdType.small)
                    }
                }
                if (hasActive) {
                    RdButton(onClick = { queue.cancelAll() }, compact = true) {
                        Text("Cancel all", style = RdType.small)
                    }
                }
            }
            RdPanel(modifier = Modifier.weight(1f).fillMaxWidth()) {
                Box(Modifier.fillMaxSize().padding(8.dp)) {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(end = RdScrollbarThickness + RdScrollbarGap),
                        contentPadding = PaddingValues(bottom = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(queue.displayJobs, key = { it.rom.id }) { job ->
                            DownloadJobRow(
                                job = job,
                                onCancel = { queue.cancelRom(job.rom.id) },
                                onRetry = {
                                    if (queue.retryRom(job.rom.id)) onStartPump()
                                },
                                onRemove = { queue.removeFailedRom(job.rom.id) },
                            )
                        }
                    }
                    RdVerticalScrollbar(
                        state = listState,
                        modifier = Modifier.align(Alignment.CenterEnd).fillMaxHeight(),
                    )
                }
            }
        }
    }
}

@Composable
private fun DownloadJobRow(
    job: DownloadJob,
    onCancel: () -> Unit,
    onRetry: () -> Unit,
    onRemove: () -> Unit,
) {
    val c = Rd
    val tone = when (job.status) {
        DownloadJobStatus.QUEUED -> BadgeTone.WARN
        DownloadJobStatus.RUNNING -> BadgeTone.ACCENT
        DownloadJobStatus.DONE -> BadgeTone.OK
        DownloadJobStatus.FAILED -> BadgeTone.ERR
    }
    val fraction = when (job.status) {
        DownloadJobStatus.DONE -> 1f
        DownloadJobStatus.RUNNING -> 0.45f
        else -> 0f
    }
    val canCancel = job.status == DownloadJobStatus.QUEUED || job.status == DownloadJobStatus.RUNNING
    val canRetry = job.status == DownloadJobStatus.FAILED

    Row(
        Modifier
            .fillMaxWidth()
            .border(1.dp, c.accent.copy(alpha = 0.4f), RectangleShape)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            Modifier
                .size(48.dp)
                .border(1.dp, c.accent.copy(alpha = 0.7f), RectangleShape)
                .background(c.bg0),
            contentAlignment = Alignment.Center,
        ) {
            RdIcon(
                if (job.status == DownloadJobStatus.FAILED) RdIconKind.WARN else RdIconKind.DOWNLOADS,
                c.accent.copy(alpha = 0.7f),
                16.dp,
            )
        }
        Column(Modifier.weight(1f)) {
            Text(
                job.rom.name,
                color = c.text,
                style = RdType.body.copy(fontWeight = FontWeight.Medium),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                job.rom.fsName ?: "",
                color = c.accent,
                style = RdType.mono.copy(fontSize = 12.sp),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            RdProgress(fraction, pulse = job.status == DownloadJobStatus.RUNNING)
            if (job.error != null) {
                Text(job.error, color = c.danger, style = RdType.small, modifier = Modifier.padding(top = 4.dp))
            }
        }
        RdBadge(job.status.name.lowercase(), tone)
        if (canRetry) {
            RdButton(onClick = onRetry, primary = true, compact = true) {
                Text("Retry", style = RdType.small)
            }
            RdButton(onClick = onRemove, compact = true) {
                Text("Remove", style = RdType.small)
            }
        }
        if (canCancel) {
            RdButton(onClick = onCancel, compact = true) {
                Text("Cancel", style = RdType.small)
            }
        }
    }
}
