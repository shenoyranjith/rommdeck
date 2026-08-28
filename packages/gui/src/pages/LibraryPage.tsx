import { useCallback, useState } from "react";
import { cn } from "../lib/cn";
import { LibraryToolbar } from "./library/LibraryToolbar";
import { PlatformSidebar } from "./library/PlatformSidebar";
import { RomBrowser } from "./library/RomBrowser";
import { RomDetailPane } from "./library/RomDetailPane";
import { useLibraryData } from "./library/useLibraryData";
import type { LibraryViewMode } from "./library/types";

const VIEW_MODE_KEY = "rommdeck.library.viewMode";

function readStoredViewMode(): LibraryViewMode {
  try {
    const raw = localStorage.getItem(VIEW_MODE_KEY);
    if (raw === "grid" || raw === "list") return raw;
  } catch {
    /* ignore */
  }
  return "grid";
}

export function LibraryPage() {
  const lib = useLibraryData();
  const [viewMode, setViewMode] = useState<LibraryViewMode>(readStoredViewMode);

  const onViewModeChange = useCallback((mode: LibraryViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="@container flex h-full min-h-0 flex-col gap-3">
      <LibraryToolbar
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        searchInput={lib.searchInput}
        onSearchInputChange={lib.setSearchInput}
        selectMode={lib.selectMode}
        selectionState={lib.selectionState}
        hasSelection={
          lib.selectionState === "all" || lib.selectionState === "partial"
        }
        hasPlatform={!!lib.selected}
        busyPlatform={lib.busyPlatform}
        busyKind={lib.busyKind}
        onSelectionButtonClick={lib.onSelectionButtonClick}
        onDownloadSelected={() => void lib.downloadSelected()}
        onDeleteSelected={() => void lib.deleteSelected()}
        onDownloadPlatform={() => void lib.downloadPlatform()}
      />

      <div
        className={cn(
          "@container grid min-h-0 flex-1 grid-cols-1 gap-3",
          lib.focusedId != null
            ? "md:grid-cols-[minmax(11rem,20cqi)_minmax(0,1fr)_minmax(16rem,22cqi)]"
            : "md:grid-cols-[minmax(11rem,22cqi)_minmax(0,1fr)]",
        )}
      >
        <PlatformSidebar
          platforms={lib.platforms}
          visiblePlatforms={lib.visiblePlatforms}
          selected={lib.selected}
          showAllPlatforms={lib.showAllPlatforms}
          onShowAllPlatforms={lib.setShowAllPlatforms}
          onSelectPlatform={lib.selectPlatform}
        />

        <RomBrowser
          platform={lib.selected}
          viewMode={viewMode}
          filter={lib.filter}
          onFilterChange={lib.setFilter}
          rangeLabel={lib.rangeLabel}
          visible={lib.visible}
          listLoading={lib.listLoading}
          loadingMore={lib.loadingMore}
          loadingAll={lib.loadingAll}
          loadingDownloaded={lib.loadingDownloaded}
          romsCount={lib.roms.length}
          total={lib.total}
          hasMore={lib.hasMore}
          scrollRef={lib.scrollRef}
          sentinelRef={lib.sentinelRef}
          selectMode={lib.selectMode}
          selectedIds={lib.selectedIds}
          focusedId={lib.focusedId}
          onCardClick={lib.onCardClick}
        />

        {lib.focusedId != null && (
          <RomDetailPane
            detail={lib.detail}
            detailError={lib.detailError}
            platform={lib.selected}
            onClose={lib.closeDetail}
            onDownload={(rom) => void lib.downloadOne(rom)}
            onDeleteLocal={(rom) => void lib.deleteLocal(rom)}
            queueStatus={
              lib.detail ? lib.activeDownloads.get(lib.detail.id) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
