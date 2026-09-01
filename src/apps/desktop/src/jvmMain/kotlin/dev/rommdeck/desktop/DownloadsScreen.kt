package dev.rommdeck.desktop

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun DownloadsScreen(queue: SessionDownloadQueue, onOpenLibrary: () -> Unit) {
    val c = Rd
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        RdPageHeader(
            title = "Downloads",
            description = if (queue.runningCount > 0 || queue.queuedCount > 0) {
                "Transfers into ROM folders"
            } else {
                "View and manage your download queue."
            },
        )
        if (queue.jobs.isEmpty()) {
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
            Text(
                "Queued ${queue.queuedCount} · running ${queue.runningCount} · done ${queue.doneCount} · failed ${queue.failedCount}",
                color = c.muted,
                style = RdType.small,
            )
            RdPanel(modifier = Modifier.weight(1f).fillMaxWidth()) {
                LazyColumn(Modifier.fillMaxWidth()) {
                    items(queue.jobs.asReversed(), key = { it.rom.id }) { job ->
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
                        }
                    }
                }
            }
        }
    }
}
