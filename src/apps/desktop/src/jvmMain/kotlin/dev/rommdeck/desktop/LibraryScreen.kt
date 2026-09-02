package dev.rommdeck.desktop

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.rommdeck.shared.config.RommDeckConfig
import dev.rommdeck.shared.db.openLibraryIndex
import dev.rommdeck.shared.download.deleteLocalRom
import dev.rommdeck.shared.play.ResolvedPlayPaths
import dev.rommdeck.shared.romm.RommPlatform
import dev.rommdeck.shared.romm.RommRom
import dev.rommdeck.shared.romm.createRommClient
import dev.rommdeck.shared.romm.coverUrlFor
import dev.rommdeck.shared.romm.platformIconUrl
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class LibraryBusyKind { PLATFORM, DOWNLOAD, DELETE }

@Composable
fun LibraryScreen(
    config: RommDeckConfig,
    paths: ResolvedPlayPaths,
    queue: SessionDownloadQueue,
    confirm: ConfirmController,
    appScope: CoroutineScope,
    busy: Boolean,
    busyKind: LibraryBusyKind?,
    onBusyChange: (Boolean, LibraryBusyKind?) -> Unit,
    onNotice: OnNotice,
    onStatsChanged: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val c = Rd
    val platformListState = rememberLazyListState()
    val romListState = rememberLazyListState()
    val romGridState = rememberLazyGridState()
    var platforms by remember { mutableStateOf(listOf<RommPlatform>()) }
    var selected by remember { mutableStateOf<RommPlatform?>(null) }
    var showEmpty by remember { mutableStateOf(false) }
    var searchInput by remember { mutableStateOf("") }
    var search by remember { mutableStateOf("") }
    var filter by remember { mutableStateOf(RomFilter.ALL) }
    var catalogRoms by remember { mutableStateOf(listOf<RommRom>()) }
    var downloadedRoms by remember { mutableStateOf(listOf<RommRom>()) }
    var downloadedDbOffset by remember { mutableIntStateOf(0) }
    var downloadedSearchTotal by remember { mutableIntStateOf(0) }
    var catalogTotal by remember { mutableStateOf(0) }
    var downloadedTotal by remember { mutableIntStateOf(0) }
    var downloadedIds by remember { mutableStateOf(setOf<Int>()) }
    var catalogLoadedFor by remember { mutableStateOf<Pair<Int, String>?>(null) }
    var loading by remember { mutableStateOf(false) }
    var loadingMore by remember { mutableStateOf(false) }
    var catalogQueryId by remember { mutableIntStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    val isComposed = remember { mutableStateOf(false) }
    DisposableEffect(Unit) {
        isComposed.value = true
        onDispose { isComposed.value = false }
    }
    fun runWhenComposed(block: () -> Unit) {
        if (isComposed.value) block()
    }
    var viewMode by remember { mutableStateOf(LibraryViewMode.GRID) }
    var selectMode by remember { mutableStateOf(false) }
    var selectAll by remember { mutableStateOf(false) }
    var selectedIds by remember { mutableStateOf(setOf<Int>()) }
    var focusedRomId by remember { mutableStateOf<Int?>(null) }
    var detailRom by remember { mutableStateOf<RommRom?>(null) }
    var detailError by remember { mutableStateOf<String?>(null) }
    var detailQueryId by remember { mutableIntStateOf(0) }

    val visiblePlatforms = if (showEmpty) platforms else platforms.filter { (it.romCount ?: 0) > 0 }
    val canDownload = paths.romsPath.isNotBlank() && config.romm.baseUrl.isNotBlank()
    val platformCatalogTotal = selected?.romCount ?: catalogTotal
    val missingTotal = maxOf(0, platformCatalogTotal - downloadedTotal)
    val downloadedDisplayTotal = if (search.isBlank()) downloadedTotal else downloadedSearchTotal
    val hasMore = when (filter) {
        RomFilter.DOWNLOADED -> downloadedDbOffset < downloadedDisplayTotal
        else -> catalogRoms.size < catalogTotal
    }
    val visibleRoms = remember(filter, catalogRoms, downloadedRoms, downloadedIds) {
        when (filter) {
            RomFilter.DOWNLOADED -> downloadedRoms
            RomFilter.MISSING -> catalogRoms.filter { it.id !in downloadedIds }
            else -> catalogRoms
        }
    }
    val selectionTotal = when (filter) {
        RomFilter.DOWNLOADED -> if (search.isBlank()) downloadedTotal else visibleRoms.size
        RomFilter.MISSING -> missingTotal
        else -> catalogTotal
    }
    val selectionState = when {
        !selectMode -> SelectionState.NONE
        selectAll -> SelectionState.ALL
        selectedIds.isEmpty() -> SelectionState.NONE
        selectionTotal > 0 && selectedIds.size >= selectionTotal -> SelectionState.ALL
        else -> SelectionState.PARTIAL
    }
    val hasSelection = selectAll || selectedIds.isNotEmpty()

    fun isRomSelected(romId: Int): Boolean = selectAll || romId in selectedIds

    fun closeDetail() {
        focusedRomId = null
        detailRom = null
        detailError = null
    }

    fun focusRom(rom: RommRom) {
        focusedRomId = rom.id
        detailRom = rom
        detailError = null
    }

    fun toggleSelect(id: Int) {
        if (selectAll) {
            selectAll = false
            selectedIds = visibleRoms.map { it.id }.filter { it != id }.toSet()
            return
        }
        selectedIds = if (id in selectedIds) selectedIds - id else selectedIds + id
    }

    fun onRomCardClick(rom: RommRom) {
        if (selectMode) toggleSelect(rom.id) else focusRom(rom)
    }

    fun exitSelectMode() {
        selectMode = false
        selectAll = false
        selectedIds = emptySet()
    }

    fun enterSelectMode() {
        closeDetail()
        selectMode = true
        selectAll = false
        selectedIds = emptySet()
    }

    fun onSelectionButtonClick() {
        if (!selectMode) {
            enterSelectMode()
            return
        }
        if (selectAll || (selectionTotal > 0 && selectedIds.size >= selectionTotal)) {
            exitSelectMode()
            return
        }
        selectAll = true
        selectedIds = emptySet()
    }

    fun romOnDisk(rom: RommRom): Boolean =
        filter == RomFilter.DOWNLOADED || rom.id in downloadedIds

    fun handleRomDeleted(id: Int) {
        if (id !in downloadedIds) return
        downloadedIds = downloadedIds - id
        downloadedTotal = maxOf(0, downloadedTotal - 1)
        if (filter == RomFilter.DOWNLOADED) {
            downloadedRoms = downloadedRoms.filter { it.id != id }
            if (search.isNotBlank()) {
                downloadedSearchTotal = maxOf(0, downloadedSearchTotal - 1)
            }
        }
    }

    LaunchedEffect(searchInput) {
        delay(300)
        search = searchInput.trim()
    }

    LaunchedEffect(focusedRomId) {
        val romId = focusedRomId ?: return@LaunchedEffect
        val queryId = ++detailQueryId
        detailError = null
        try {
            val full = withContext(Dispatchers.IO) {
                val client = createRommClient(config.romm)
                try {
                    client.getRom(romId)
                } finally {
                    client.close()
                }
            }
            if (queryId == detailQueryId) {
                detailRom = full
            }
        } catch (e: Exception) {
            if (queryId == detailQueryId) {
                detailError = e.message ?: e.toString()
            }
        }
    }

    LaunchedEffect(selected?.id, filter, search) {
        closeDetail()
    }

    LaunchedEffect(config.romm.baseUrl, config.romm.apiToken) {
        if (config.romm.baseUrl.isBlank()) {
            platforms = emptyList()
            selected = null
            return@LaunchedEffect
        }
        loading = true
        error = null
        try {
            val list = withContext(Dispatchers.IO) {
                val client = createRommClient(config.romm)
                try {
                    client.getPlatforms()
                } finally {
                    client.close()
                }
            }
            platforms = list.sortedBy { it.displayName ?: it.name }
            val withRoms = list.filter { (it.romCount ?: 0) > 0 }
            selected = withRoms.firstOrNull() ?: list.firstOrNull()
        } catch (e: Exception) {
            error = e.message ?: e.toString()
        } finally {
            loading = false
        }
    }

    LaunchedEffect(selected?.id) {
        val platform = selected ?: return@LaunchedEffect
        downloadedIds = withContext(Dispatchers.IO) { loadDownloadedIds() }
        downloadedTotal = withContext(Dispatchers.IO) {
            loadDownloadedCountForSlug(platform.slug)
        }
    }

    LaunchedEffect(queue.completionCount) {
        if (queue.completionCount == 0) return@LaunchedEffect
        downloadedIds = withContext(Dispatchers.IO) { loadDownloadedIds() }
        selected?.slug?.let { slug ->
            downloadedTotal = withContext(Dispatchers.IO) { loadDownloadedCountForSlug(slug) }
        }
    }

    LaunchedEffect(selected?.id, search, filter) {
        exitSelectMode()
        val platform = selected ?: return@LaunchedEffect
        if (filter == RomFilter.DOWNLOADED) return@LaunchedEffect
        val key = platform.id to search
        if (catalogLoadedFor == key && catalogRoms.isNotEmpty()) return@LaunchedEffect
        loading = true
        loadingMore = false
        val queryId = ++catalogQueryId
        error = null
        try {
            val page = withContext(Dispatchers.IO) {
                val client = createRommClient(config.romm)
                try {
                    client.getRoms(platform.id, search.ifBlank { null }, limit = CatalogPageSize, offset = 0)
                } finally {
                    client.close()
                }
            }
            if (queryId != catalogQueryId) return@LaunchedEffect
            catalogRoms = page.items
            catalogTotal = page.total
            catalogLoadedFor = key
        } catch (e: Exception) {
            if (queryId == catalogQueryId) {
                error = e.message ?: e.toString()
            }
        } finally {
            if (queryId == catalogQueryId) {
                loading = false
            }
        }
    }

    LaunchedEffect(selected?.id, search, filter) {
        if (filter != RomFilter.DOWNLOADED) return@LaunchedEffect
        val platform = selected ?: return@LaunchedEffect
        exitSelectMode()
        loading = true
        loadingMore = false
        val queryId = ++catalogQueryId
        error = null
        downloadedRoms = emptyList()
        downloadedDbOffset = 0
        try {
            if (search.isNotBlank()) {
                downloadedSearchTotal = withContext(Dispatchers.IO) {
                    loadDownloadedSearchCount(platform.slug, search)
                }
            }
            if (queryId != catalogQueryId) return@LaunchedEffect
            val page = withContext(Dispatchers.IO) {
                loadDownloadedRomsPage(config.romm, platform.slug, search, CatalogPageSize, 0)
            }
            if (queryId != catalogQueryId) return@LaunchedEffect
            downloadedRoms = page
            downloadedDbOffset = CatalogPageSize
        } catch (e: Exception) {
            if (queryId == catalogQueryId) {
                error = e.message ?: e.toString()
            }
        } finally {
            if (queryId == catalogQueryId) {
                loading = false
            }
        }
    }

    fun loadMoreCatalog() {
        if (loading || loadingMore || !hasMore) return
        val platform = selected ?: return
        val queryId = catalogQueryId
        scope.launch {
            loadingMore = true
            try {
                if (filter == RomFilter.DOWNLOADED) {
                    val page = withContext(Dispatchers.IO) {
                        loadDownloadedRomsPage(
                            config.romm,
                            platform.slug,
                            search,
                            CatalogPageSize,
                            downloadedDbOffset,
                        )
                    }
                    if (queryId != catalogQueryId) return@launch
                    downloadedRoms = downloadedRoms + page
                    downloadedDbOffset += CatalogPageSize
                } else {
                    val offset = catalogRoms.size
                    val page = withContext(Dispatchers.IO) {
                        val client = createRommClient(config.romm)
                        try {
                            client.getRoms(platform.id, search.ifBlank { null }, CatalogPageSize, offset)
                        } finally {
                            client.close()
                        }
                    }
                    if (queryId != catalogQueryId) return@launch
                    catalogRoms = catalogRoms + page.items
                    catalogTotal = page.total
                }
            } catch (e: Exception) {
                if (queryId == catalogQueryId) {
                    error = e.message ?: e.toString()
                }
            } finally {
                if (queryId == catalogQueryId) {
                    loadingMore = false
                }
            }
        }
    }

    LaunchedEffect(viewMode, filter, hasMore, loading, loadingMore) {
        if (viewMode == LibraryViewMode.LIST) {
            snapshotFlow {
                val info = romListState.layoutInfo
                val last = info.visibleItemsInfo.lastOrNull()?.index ?: -1
                last to info.totalItemsCount
            }.collect { (last, total) ->
                if (total > 0 && last >= total - 3 && hasMore && !loading && !loadingMore) {
                    loadMoreCatalog()
                }
            }
        } else {
            snapshotFlow {
                val info = romGridState.layoutInfo
                val last = info.visibleItemsInfo.lastOrNull()?.index ?: -1
                last to info.totalItemsCount
            }.collect { (last, total) ->
                if (total > 0 && last >= total - 3 && hasMore && !loading && !loadingMore) {
                    loadMoreCatalog()
                }
            }
        }
    }

    fun startPump() {
        queue.startPump(config, paths, onStatsChanged)
    }

    fun deleteRomWithConfirm(rom: RommRom) {
        scope.launch {
            if (!confirm.confirmDeleteLocal("Delete local files for \"${rom.name}\"?")) return@launch
            val result = withContext(Dispatchers.IO) {
                val index = openLibraryIndex()
                try {
                    deleteLocalRom(index, rom.id)
                } finally {
                    index.close()
                }
            }
            if (!result.fullyRemoved) {
                onNotice(
                    "Could not delete ${result.filesFailed.size} file(s) — close other apps using them and retry",
                    NotificationTone.Err,
                )
                return@launch
            }
            handleRomDeleted(rom.id)
            onStatsChanged()
            onNotice("Removed local files")
        }
    }

    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Library", color = c.text, style = RdType.title)
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RdViewModeToggle(
                viewMode = viewMode,
                onViewModeChange = { viewMode = it },
            )
            Box(Modifier.weight(1f)) {
                RdField(
                    value = searchInput,
                    onValueChange = { searchInput = it },
                    placeholder = "Search library…",
                    leading = { RdIcon(RdIconKind.SEARCH, c.accent, 16.dp) },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            RdIconButton(
                onClick = { onSelectionButtonClick() },
                selected = selectMode,
            ) {
                RdSelectionIcon(if (selectMode) selectionState else SelectionState.NONE)
            }
            if (selectMode) {
                RdButton(
                    onClick = {
                        if (!canDownload) {
                            onNotice("Set RomM URL and a ROM folder in Settings")
                            return@RdButton
                        }
                        onBusyChange(true, LibraryBusyKind.DOWNLOAD)
                        appScope.launch {
                            try {
                                val toQueue = if (selectAll) {
                                    when (filter) {
                                        RomFilter.DOWNLOADED -> emptyList()
                                        else -> {
                                            val platform = selected ?: return@launch
                                            fetchAllCatalogRoms(
                                                config.romm,
                                                platform.id,
                                                search.ifBlank { null },
                                            ).filter { it.id !in downloadedIds }
                                        }
                                    }
                                } else {
                                    visibleRoms.filter { it.id in selectedIds && it.id !in downloadedIds }
                                }
                                if (toQueue.isEmpty()) {
                                    onNotice("Nothing to download for the current selection")
                                    return@launch
                                }
                                val n = queue.enqueue(toQueue)
                                onNotice(if (n == 0) "Already queued" else "Queued $n ROM(s)")
                                startPump()
                                withContext(Dispatchers.Main) {
                                    runWhenComposed { exitSelectMode() }
                                }
                            } catch (e: Exception) {
                                onNotice(e.message ?: e.toString(), NotificationTone.Err)
                            } finally {
                                onBusyChange(false, null)
                            }
                        }
                    },
                    primary = true,
                    enabled = hasSelection && canDownload && !busy,
                ) {
                    Text(
                        if (busyKind == LibraryBusyKind.DOWNLOAD) "Queuing…" else "Download selected",
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                RdButton(
                    onClick = {
                        appScope.launch {
                            val ids = if (selectAll) {
                                val platform = selected
                                when {
                                    filter == RomFilter.MISSING -> emptyList()
                                    filter == RomFilter.DOWNLOADED && platform != null ->
                                        withContext(Dispatchers.IO) {
                                            loadAllDownloadedIdsForSlug(platform.slug, search)
                                        }
                                    platform != null && search.isBlank() ->
                                        withContext(Dispatchers.IO) {
                                            loadDownloadedIdsForSlug(platform.slug).toList()
                                        }
                                    platform != null -> {
                                        val all = fetchAllCatalogRoms(
                                            config.romm,
                                            platform.id,
                                            search.ifBlank { null },
                                        )
                                        all.filter { it.id in downloadedIds }.map { it.id }
                                    }
                                    else -> emptyList()
                                }
                            } else {
                                visibleRoms.filter { it.id in selectedIds && it.id in downloadedIds }.map { it.id }
                            }
                            if (ids.isEmpty()) {
                                onNotice("No local files in the current selection")
                                return@launch
                            }
                            val countLabel = if (ids.size == 1) "1 ROM" else "${ids.size} ROMs"
                            if (!confirm.confirmDeleteLocal("Delete local files for $countLabel?")) return@launch
                            onBusyChange(true, LibraryBusyKind.DELETE)
                            try {
                                val (clearedIds, filesFailed) = withContext(Dispatchers.IO) {
                                    val index = openLibraryIndex()
                                    try {
                                        val failed = mutableListOf<String>()
                                        ids.forEach { romId ->
                                            failed += deleteLocalRom(index, romId).filesFailed
                                        }
                                        val cleared = ids.filter { index.getByRomId(it).isEmpty() }
                                        cleared to failed
                                    } finally {
                                        index.close()
                                    }
                                }
                                onStatsChanged()
                                if (filesFailed.isEmpty()) {
                                    onNotice("Removed local copies of ${ids.size} ROM(s)")
                                } else {
                                    onNotice(
                                        "Removed ${clearedIds.size} of ${ids.size} ROM(s); " +
                                            "${filesFailed.size} file(s) could not be deleted",
                                        NotificationTone.Err,
                                    )
                                }
                                withContext(Dispatchers.Main) {
                                    runWhenComposed {
                                        downloadedIds = downloadedIds - clearedIds.toSet()
                                        downloadedTotal = maxOf(0, downloadedTotal - clearedIds.size)
                                        if (filter == RomFilter.DOWNLOADED) {
                                            downloadedRoms = downloadedRoms.filter { it.id !in clearedIds }
                                            if (search.isNotBlank()) {
                                                downloadedSearchTotal =
                                                    maxOf(0, downloadedSearchTotal - clearedIds.size)
                                            }
                                        }
                                        exitSelectMode()
                                    }
                                }
                            } catch (e: Exception) {
                                onNotice(e.message ?: e.toString(), NotificationTone.Err)
                            } finally {
                                onBusyChange(false, null)
                            }
                        }
                    },
                    danger = true,
                    enabled = hasSelection && !busy,
                ) {
                    Text(
                        if (busyKind == LibraryBusyKind.DELETE) "Deleting…" else "Delete selected",
                        color = LocalContentColor.current,
                    )
                }
            } else {
            RdButton(
                onClick = {
                    val platform = selected ?: return@RdButton
                    if (!canDownload) {
                        onNotice("Set RomM URL and a ROM folder in Settings")
                        return@RdButton
                    }
                    onBusyChange(true, LibraryBusyKind.PLATFORM)
                    appScope.launch {
                        try {
                            val have = withContext(Dispatchers.IO) { loadDownloadedIds() }
                            val missing = mutableListOf<RommRom>()
                            withContext(Dispatchers.IO) {
                                val client = createRommClient(config.romm)
                                try {
                                    var offset = 0
                                    while (true) {
                                        val page = client.getRoms(platform.id, search.ifBlank { null }, 100, offset)
                                        missing += page.items.filter { it.id !in have }
                                        offset += page.items.size
                                        if (page.items.isEmpty() || offset >= page.total) break
                                    }
                                } finally {
                                    client.close()
                                }
                            }
                            if (missing.isEmpty()) {
                                onNotice("Nothing to download for ${platform.name}")
                                return@launch
                            }
                            val n = queue.enqueue(missing)
                            onNotice(if (n == 0) "Already queued" else "Queued $n ROM(s)")
                            startPump()
                        } catch (e: Exception) {
                            onNotice(e.message ?: e.toString(), NotificationTone.Err)
                        } finally {
                            onBusyChange(false, null)
                        }
                    }
                },
                primary = true,
                enabled = selected != null && canDownload && !busy,
            ) {
                Text(
                    if (busyKind == LibraryBusyKind.PLATFORM) "Queuing…" else "Download platform",
                    fontWeight = FontWeight.SemiBold,
                )
            }
            RdIconButton(
                onClick = {
                    val platform = selected ?: return@RdIconButton
                    scope.launch {
                        loading = true
                        try {
                            downloadedIds = withContext(Dispatchers.IO) { loadDownloadedIds() }
                            downloadedTotal = withContext(Dispatchers.IO) {
                                loadDownloadedCountForSlug(platform.slug)
                            }
                            if (filter == RomFilter.DOWNLOADED) {
                                downloadedDbOffset = 0
                                if (search.isNotBlank()) {
                                    downloadedSearchTotal = withContext(Dispatchers.IO) {
                                        loadDownloadedSearchCount(platform.slug, search)
                                    }
                                }
                                downloadedRoms = withContext(Dispatchers.IO) {
                                    loadDownloadedRomsPage(config.romm, platform.slug, search, CatalogPageSize, 0)
                                }
                                downloadedDbOffset = CatalogPageSize
                            } else {
                                val page = withContext(Dispatchers.IO) {
                                    val client = createRommClient(config.romm)
                                    try {
                                        client.getRoms(platform.id, search.ifBlank { null }, CatalogPageSize, 0)
                                    } finally {
                                        client.close()
                                    }
                                }
                                catalogRoms = page.items
                                catalogTotal = page.total
                                catalogLoadedFor = platform.id to search
                            }
                            onNotice("Library refreshed")
                        } catch (e: Exception) {
                            error = e.message
                        } finally {
                            loading = false
                        }
                    }
                },
                enabled = !loading && !busy,
            ) {
                Icon(
                    Icons.Filled.Refresh,
                    contentDescription = "Refresh library",
                    modifier = Modifier.size(16.dp),
                    tint = c.text,
                )
            }
            }
        }

        Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(
                Modifier
                    .width(220.dp)
                    .fillMaxHeight()
                    .border(1.dp, c.accent, RectangleShape)
                    .background(c.bg0.copy(alpha = 0.6f)),
            ) {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .border(1.dp, c.accent.copy(alpha = 0.5f), RectangleShape)
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                ) {
                    Text("PLATFORMS", color = c.accent, style = RdType.micro)
                    RdSegmented(
                        options = listOf("With ROMs", "All"),
                        selectedIndex = if (showEmpty) 1 else 0,
                        onSelect = { showEmpty = it == 1 },
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                        fillWidth = true,
                    )
                }
                Box(Modifier.weight(1f)) {
                    LazyColumn(
                        state = platformListState,
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(start = 6.dp, top = 6.dp, bottom = 6.dp)
                            .padding(end = 6.dp + RdScrollbarThickness),
                    ) {
                    items(visiblePlatforms, key = { it.id }) { platform ->
                        val active = selected?.id == platform.id
                        val initials = (platform.displayName ?: platform.name).take(2).uppercase()
                        val iconUrl = platformIconUrl(config.romm.baseUrl, platform)
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .padding(bottom = 2.dp)
                                .platformItemSelection(active, c.accent)
                                .rdInteractive(onClick = { selected = platform })
                                .padding(horizontal = 10.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                Modifier
                                    .size(28.dp)
                                    .border(1.dp, if (active) c.accent.copy(alpha = 0.7f) else c.line, RectangleShape)
                                    .background(c.bg0)
                                    .padding(2.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                RommAssetImage(
                                    url = iconUrl,
                                    apiToken = config.romm.apiToken,
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Fit,
                                ) {
                                    Text(
                                        initials,
                                        color = c.muted,
                                        style = RdType.micro.copy(letterSpacing = 0.4.sp, fontSize = 10.sp),
                                    )
                                }
                            }
                            Text(
                                platform.displayName ?: platform.name,
                                color = if (active) c.accent else c.text,
                                style = RdType.small.copy(fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal),
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
                            )
                            Text(
                                "${platform.romCount ?: "—"}",
                                color = c.accent,
                                style = RdType.mono.copy(fontSize = 12.sp),
                            )
                        }
                    }
                    if (platforms.isEmpty()) {
                        item {
                            Text(
                                "No platforms. Check Settings.",
                                color = c.muted,
                                style = RdType.small,
                                modifier = Modifier.fillMaxWidth().padding(12.dp),
                            )
                        }
                    }
                }
                    RdVerticalScrollbar(
                        state = platformListState,
                        modifier = Modifier.align(Alignment.CenterEnd).fillMaxHeight(),
                    )
                }
            }

            Column(
                Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .border(1.dp, c.accent, RectangleShape)
                    .background(c.bg0.copy(alpha = 0.6f)),
            ) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .border(1.dp, c.accent.copy(alpha = 0.5f), RectangleShape)
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    val romCountLabel = when {
                        loading && filter == RomFilter.ALL -> "loading…"
                        loading && filter == RomFilter.MISSING -> "loading…"
                        loadingMore -> when (filter) {
                            RomFilter.DOWNLOADED ->
                                "Loading more… ${downloadedRoms.size} of $downloadedDisplayTotal"
                            else -> "Loading more… ${catalogRoms.size} of $catalogTotal"
                        }
                        filter == RomFilter.DOWNLOADED -> {
                            if (loading) {
                                if (downloadedDisplayTotal == 0) "loading…"
                                else "$downloadedDisplayTotal downloaded · loading…"
                            } else if (search.isNotBlank()) {
                                "${visibleRoms.size} of $downloadedSearchTotal downloaded"
                            } else {
                                "$downloadedTotal downloaded"
                            }
                        }
                        filter == RomFilter.MISSING -> {
                            if (loading) "$missingTotal missing · loading…"
                            else "$missingTotal missing"
                        }
                        catalogTotal == 0 -> "0 ROMs"
                        else -> "${catalogRoms.size} of $catalogTotal"
                    }
                    Text(
                        romCountLabel,
                        color = c.accent,
                        style = RdType.mono.copy(fontSize = 12.sp),
                        modifier = Modifier
                            .weight(1f)
                            .padding(end = 12.dp),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    RdSegmented(
                        options = RomFilter.entries.map { it.label },
                        selectedIndex = RomFilter.entries.indexOf(filter),
                        onSelect = { filter = RomFilter.entries[it] },
                    )
                }
                if (error != null) {
                    Text(
                        error!!,
                        color = c.danger,
                        style = RdType.small,
                        modifier = Modifier.padding(12.dp),
                    )
                }
                val romScrollModifier = Modifier
                    .fillMaxSize()
                    .padding(end = RdScrollbarThickness)
                Box(Modifier.weight(1f).fillMaxWidth().padding(8.dp)) {
                if (viewMode == LibraryViewMode.LIST) {
                    LazyColumn(
                        state = romListState,
                        modifier = romScrollModifier,
                        contentPadding = PaddingValues(bottom = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(visibleRoms, key = { it.id }) { rom ->
                            RomListItem(
                                rom = rom,
                                rommBaseUrl = config.romm.baseUrl,
                                apiToken = config.romm.apiToken,
                                onDisk = romOnDisk(rom),
                                canDownload = canDownload,
                                queue = queue,
                                onNotice = onNotice,
                                onStatsChanged = onStatsChanged,
                                startPump = ::startPump,
                                onDelete = { deleteRomWithConfirm(rom) },
                                selectMode = selectMode,
                                isSelected = isRomSelected(rom.id),
                                isFocused = focusedRomId == rom.id,
                                onToggleSelect = { toggleSelect(rom.id) },
                                onCardClick = { onRomCardClick(rom) },
                            )
                        }
                    }
                    RdVerticalScrollbar(
                        state = romListState,
                        modifier = Modifier.align(Alignment.CenterEnd).fillMaxHeight(),
                    )
                } else {
                    LazyVerticalGrid(
                        state = romGridState,
                        modifier = romScrollModifier.padding(end = RdScrollbarGap),
                        columns = GridCells.Adaptive(minSize = 150.dp),
                        contentPadding = PaddingValues(bottom = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(visibleRoms, key = { it.id }) { rom ->
                            RomGridCard(
                                rom = rom,
                                rommBaseUrl = config.romm.baseUrl,
                                apiToken = config.romm.apiToken,
                                onDisk = romOnDisk(rom),
                                canDownload = canDownload,
                                queue = queue,
                                onNotice = onNotice,
                                onStatsChanged = onStatsChanged,
                                startPump = ::startPump,
                                onDelete = { deleteRomWithConfirm(rom) },
                                selectMode = selectMode,
                                isSelected = isRomSelected(rom.id),
                                isFocused = focusedRomId == rom.id,
                                onToggleSelect = { toggleSelect(rom.id) },
                                onCardClick = { onRomCardClick(rom) },
                            )
                        }
                    }
                    RdVerticalScrollbar(
                        state = romGridState,
                        modifier = Modifier.align(Alignment.CenterEnd).fillMaxHeight(),
                    )
                }
                }
            }

            if (focusedRomId != null) {
                RomDetailPane(
                    detail = detailRom,
                    detailError = detailError,
                    platform = selected,
                    onDisk = detailRom?.let { romOnDisk(it) } == true,
                    loading = detailRom == null && detailError == null,
                    queueStatus = focusedRomId?.let { queue.activeJobStatus(it) },
                    canDownload = canDownload,
                    rommBaseUrl = config.romm.baseUrl,
                    apiToken = config.romm.apiToken,
                    onClose = ::closeDetail,
                    onDownload = { rom ->
                        if (!canDownload) {
                            onNotice("Set RomM URL and a ROM folder in Settings")
                            return@RomDetailPane
                        }
                        val n = queue.enqueue(listOf(rom))
                        if (n == 0) onNotice("Already queued")
                        else {
                            onNotice("Queued ${rom.name}")
                            startPump()
                        }
                    },
                    onDelete = { rom -> deleteRomWithConfirm(rom) },
                )
            }
        }
    }
}

@Composable
internal fun RomCoverFallback(modifier: Modifier = Modifier, compact: Boolean = false) {
    val c = Rd
    Column(
        modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        RdIcon(RdIconKind.WARN, c.accent.copy(alpha = 0.8f), if (compact) 16.dp else 20.dp)
        if (!compact) {
            Text(
                "NO COVER",
                color = c.accent,
                style = RdType.micro.copy(fontSize = 10.sp, fontWeight = FontWeight.SemiBold),
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Composable
private fun RomListItem(
    rom: RommRom,
    rommBaseUrl: String,
    apiToken: String,
    onDisk: Boolean,
    canDownload: Boolean,
    queue: SessionDownloadQueue,
    onNotice: OnNotice,
    onStatsChanged: () -> Unit,
    startPump: () -> Unit,
    onDelete: () -> Unit,
    selectMode: Boolean = false,
    isSelected: Boolean = false,
    isFocused: Boolean = false,
    onToggleSelect: () -> Unit = {},
    onCardClick: () -> Unit = {},
) {
    val coverUrl = coverUrlFor(rommBaseUrl, rom)
    RomRow(
        title = rom.name,
        subtitle = buildString {
            append(formatBytes(rom.fsSizeBytes))
            if (onDisk) append(" · on disk")
        },
        coverUrl = coverUrl,
        apiToken = apiToken,
        onDisk = onDisk,
        selectMode = selectMode,
        isSelected = isSelected,
        isFocused = isFocused,
        onToggleSelect = onToggleSelect,
        onCardClick = onCardClick,
        onDownload = {
            if (!canDownload) {
                onNotice("Set RomM URL and a ROM folder in Settings")
                return@RomRow
            }
            val n = queue.enqueue(listOf(rom))
            if (n == 0) onNotice("Already queued")
            else {
                onNotice("Queued ${rom.name}")
                startPump()
            }
        },
        onDelete = onDelete,
        canDownload = canDownload,
    )
}

@Composable
private fun RomGridCard(
    rom: RommRom,
    rommBaseUrl: String,
    apiToken: String,
    onDisk: Boolean,
    canDownload: Boolean,
    queue: SessionDownloadQueue,
    onNotice: OnNotice,
    onStatsChanged: () -> Unit,
    startPump: () -> Unit,
    onDelete: () -> Unit,
    selectMode: Boolean = false,
    isSelected: Boolean = false,
    isFocused: Boolean = false,
    onToggleSelect: () -> Unit = {},
    onCardClick: () -> Unit = {},
) {
    val c = Rd
    val scope = rememberCoroutineScope()
    val coverUrl = coverUrlFor(rommBaseUrl, rom, preferLarge = true)
    val statusLabel = if (onDisk) "On disk" else "Missing"
    val statusTone = if (onDisk) BadgeTone.OK else BadgeTone.WARN

    Column(
        Modifier
            .fillMaxWidth()
            .border(
                1.dp,
                when {
                    isFocused || isSelected -> c.accent
                    else -> c.accent.copy(alpha = 0.8f)
                },
                RectangleShape,
            )
            .background(c.bg2, RectangleShape)
            .then(
                if (selectMode) {
                    Modifier.rdInteractive(onClick = onToggleSelect)
                } else {
                    Modifier.rdInteractive(onClick = onCardClick)
                },
            ),
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(180.dp)
                .border(1.dp, c.accent.copy(alpha = 0.4f), RectangleShape)
                .background(c.bg0),
            contentAlignment = Alignment.Center,
        ) {
            RommAssetImage(
                url = coverUrl,
                apiToken = apiToken,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Fit,
            ) {
                RomCoverFallback(Modifier.fillMaxSize())
            }
            if (selectMode && isSelected) {
                Box(
                    Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                        .size(28.dp)
                        .border(1.dp, c.accent, RectangleShape)
                        .background(c.accent),
                    contentAlignment = Alignment.Center,
                ) {
                    RdIcon(RdIconKind.CHECK, c.accentFg, 16.dp)
                }
            }
        }
        Column(
            Modifier
                .padding(RomGridBodyPadding)
                .fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(RomGridBodyGap),
        ) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(RomGridTitleHeight),
                contentAlignment = Alignment.TopStart,
            ) {
                RdEllipsisText(
                    text = rom.name,
                    style = RdType.small.copy(fontWeight = FontWeight.Medium, lineHeight = 18.sp),
                    maxLines = 2,
                )
            }
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(RomGridBadgeHeight),
                contentAlignment = Alignment.Center,
            ) {
                RdBadge(statusLabel, tone = statusTone, modifier = Modifier.fillMaxWidth())
            }
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(RomGridActionHeight),
                contentAlignment = Alignment.Center,
            ) {
            if (!selectMode) {
            if (onDisk) {
                RdButton(onClick = onDelete, danger = true, compact = true, modifier = Modifier.fillMaxWidth()) {
                    Text("Delete", color = LocalContentColor.current, style = RdType.small)
                }
            } else {
                RdButton(
                    onClick = {
                        if (!canDownload) {
                            onNotice("Set RomM URL and a ROM folder in Settings")
                            return@RdButton
                        }
                        val n = queue.enqueue(listOf(rom))
                        if (n == 0) onNotice("Already queued")
                        else {
                            onNotice("Queued ${rom.name}")
                            startPump()
                        }
                    },
                    primary = true,
                    enabled = canDownload,
                    compact = true,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Download", fontWeight = FontWeight.SemiBold, style = RdType.small)
                }
            }
            }
            }
        }
    }
}

@Composable
private fun RomRow(
    title: String,
    subtitle: String,
    onDisk: Boolean,
    onDownload: () -> Unit,
    onDelete: () -> Unit,
    canDownload: Boolean = true,
    coverUrl: String? = null,
    apiToken: String = "",
    selectMode: Boolean = false,
    isSelected: Boolean = false,
    isFocused: Boolean = false,
    onToggleSelect: () -> Unit = {},
    onCardClick: () -> Unit = {},
) {
    val c = Rd
    Row(
        Modifier
            .fillMaxWidth()
            .height(72.dp)
            .border(
                1.dp,
                when {
                    isFocused || isSelected -> c.accent
                    else -> c.accent.copy(alpha = 0.7f)
                },
                RectangleShape,
            )
            .background(if (isSelected || isFocused) c.accent.copy(alpha = 0.15f) else c.bg2)
            .then(
                if (selectMode) {
                    Modifier.rdInteractive(onClick = onToggleSelect)
                } else {
                    Modifier.rdInteractive(onClick = onCardClick)
                },
            )
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (selectMode) {
            Box(
                Modifier
                    .size(20.dp)
                    .border(1.dp, if (isSelected) c.accent else c.line, RectangleShape)
                    .background(if (isSelected) c.accent else c.bg0),
                contentAlignment = Alignment.Center,
            ) {
                if (isSelected) {
                    RdIcon(RdIconKind.CHECK, c.accentFg, 12.dp)
                }
            }
        }
        Box(
            Modifier
                .size(48.dp)
                .border(1.dp, c.accent.copy(alpha = 0.4f), RectangleShape)
                .background(c.bg0),
            contentAlignment = Alignment.Center,
        ) {
            RommAssetImage(
                url = coverUrl,
                apiToken = apiToken,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            ) {
                RdIcon(if (onDisk) RdIconKind.CHECK else RdIconKind.WARN, c.accent.copy(alpha = 0.7f), 16.dp)
            }
        }
        Column(Modifier.weight(1f)) {
            RdEllipsisText(
                text = title,
                style = RdType.body.copy(fontWeight = FontWeight.Medium),
            )
            RdEllipsisText(
                text = subtitle,
                color = c.accent,
                style = RdType.small.copy(fontSize = 12.sp),
            )
        }
        if (!selectMode) {
        if (onDisk) {
            RdButton(onClick = onDelete, danger = true, compact = true) {
                Text("Delete", color = LocalContentColor.current, style = RdType.small)
            }
        } else {
            RdButton(onClick = onDownload, primary = true, enabled = canDownload, compact = true) {
                Text("Download", fontWeight = FontWeight.SemiBold, style = RdType.small)
            }
        }
        }
    }
}

private fun Modifier.platformItemSelection(active: Boolean, accent: Color): Modifier {
    if (!active) {
        return border(1.dp, Color.Transparent, RectangleShape)
    }
    return background(accent.copy(alpha = 0.15f))
        .drawBehind {
            val left = 6.dp.toPx()
            val stroke = 1.dp.toPx()
            drawRect(accent, size = Size(left, size.height))
            drawLine(accent, Offset(left, 0f), Offset(size.width, 0f), strokeWidth = stroke)
            drawLine(
                accent,
                Offset(size.width - stroke / 2f, 0f),
                Offset(size.width - stroke / 2f, size.height),
                strokeWidth = stroke,
            )
            drawLine(
                accent,
                Offset(left, size.height - stroke / 2f),
                Offset(size.width, size.height - stroke / 2f),
                strokeWidth = stroke,
            )
        }
}
