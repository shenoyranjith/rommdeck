import type { RefObject } from "react";
import { cn } from "../../lib/cn";
import { RomGrid } from "./RomGrid";
import type { Platform, RomItem, StatusFilter } from "./types";

export function RomBrowser({
  platform,
  filter,
  onFilterChange,
  rangeLabel,
  visible,
  listLoading,
  loadingMore,
  loadingAll,
  loadingDownloaded,
  romsCount,
  total,
  hasMore,
  scrollRef,
  sentinelRef,
  selectMode,
  selectedIds,
  focusedId,
  onCardClick,
  onDownload,
  onDeleteLocal,
}: {
  platform: Platform | null;
  filter: StatusFilter;
  onFilterChange: (filter: StatusFilter) => void;
  rangeLabel: string;
  visible: RomItem[];
  listLoading: boolean;
  loadingMore: boolean;
  loadingAll: boolean;
  loadingDownloaded: boolean;
  romsCount: number;
  total: number;
  hasMore: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLDivElement | null>;
  selectMode: boolean;
  selectedIds: Set<number>;
  focusedId: number | null;
  onCardClick: (rom: RomItem) => void;
  onDownload: (rom: RomItem) => void;
  onDeleteLocal: (rom: RomItem) => void;
}) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-line bg-bg0/50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2 text-sm">
        <span className="text-text">{platform ? platform.displayName || platform.name : "ROMs"}</span>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex rounded-md border border-line p-0.5 text-[11px]"
            title="Downloaded comes from the local library DB; Missing is the platform catalog minus those"
          >
            {(
              [
                ["all", "All"],
                ["downloaded", "Downloaded"],
                ["missing", "Missing"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={cn(
                  "rounded px-2.5 py-1 font-medium transition-colors",
                  filter === value ? "bg-accent text-accent-fg" : "text-muted hover:text-text",
                )}
                onClick={() => onFilterChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="font-mono text-accent">{rangeLabel}</span>
        </div>
      </div>

      {visible.length === 0 && !loadingMore && !loadingAll && !loadingDownloaded ? (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted">
          {listLoading ? "Loading…" : "No ROMs to show"}
        </div>
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-3">
          <RomGrid
            roms={visible}
            scrollRef={scrollRef}
            selectMode={selectMode}
            selectedIds={selectedIds}
            focusedId={focusedId}
            onCardClick={onCardClick}
            onDownload={onDownload}
            onDeleteLocal={onDeleteLocal}
            footer={
              <div ref={sentinelRef} className="flex h-10 items-center justify-center text-xs text-muted">
                {loadingDownloaded
                  ? "Loading downloaded…"
                  : loadingAll
                    ? `Loading catalog… ${romsCount}/${total || "…"}`
                    : loadingMore
                      ? "Loading more…"
                      : hasMore
                        ? null
                        : romsCount > 0 && filter === "all"
                          ? "End of list"
                          : null}
              </div>
            }
          />
        </div>
      )}
    </section>
  );
}
