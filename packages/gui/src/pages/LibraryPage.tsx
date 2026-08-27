import { cn } from "../lib/cn";
import { LibraryToolbar } from "./library/LibraryToolbar";
import { PlatformSidebar } from "./library/PlatformSidebar";
import { RomBrowser } from "./library/RomBrowser";
import { RomDetailPane } from "./library/RomDetailPane";
import { useLibraryData } from "./library/useLibraryData";

export function LibraryPage() {
  const lib = useLibraryData();

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <LibraryToolbar
        searchInput={lib.searchInput}
        onSearchInputChange={lib.setSearchInput}
        selectMode={lib.selectMode}
        selectedCount={lib.selectedIds.size}
        hasPlatform={!!lib.selected}
        busyPlatform={lib.busyPlatform}
        onToggleSelectMode={lib.toggleSelectMode}
        onDownloadSelected={() => void lib.downloadSelected()}
        onDownloadPlatform={() => void lib.downloadPlatform()}
      />

      {lib.message && (
        <div className="rounded-md border border-ok/40 bg-bg2 px-3 py-2 text-sm text-ok">{lib.message}</div>
      )}
      {lib.error && (
        <div className="rounded-md border border-danger/40 bg-bg2 px-3 py-2 text-sm text-danger">{lib.error}</div>
      )}

      <div
        className={cn(
          "grid min-h-0 flex-1 grid-cols-1 gap-3",
          lib.focusedId != null
            ? "md:grid-cols-[200px_minmax(0,1fr)_minmax(280px,320px)]"
            : "md:grid-cols-[220px_1fr]",
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
          onDownload={(rom) => void lib.downloadOne(rom)}
          onDeleteLocal={(rom) => void lib.deleteLocal(rom)}
        />

        {lib.focusedId != null && (
          <RomDetailPane
            detail={lib.detail}
            detailError={lib.detailError}
            platform={lib.selected}
            onClose={lib.closeDetail}
            onDownload={(rom) => void lib.downloadOne(rom)}
            onDeleteLocal={(rom) => void lib.deleteLocal(rom)}
          />
        )}
      </div>
    </div>
  );
}
