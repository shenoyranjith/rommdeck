import type { RefObject } from "react";
import { cn } from "../../lib/cn";
import { RomGrid } from "./RomGrid";
import { RomList } from "./RomList";
import type { LibraryViewMode, Platform, RomItem, StatusFilter } from "./types";

export function RomBrowser({
  platform,
  viewMode,
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
}: {
  platform: Platform | null;
  viewMode: LibraryViewMode;
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
}) {
  const footer = (
    <div
      ref={sentinelRef}
      className="flex h-10 items-center justify-center text-xs text-muted"
    >
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
  );

  return (
    <section className="flex min-h-0 flex-col overflow-hidden border border-accent bg-bg0/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-accent/50 px-3 py-2.5 text-sm">
        <span className="font-medium text-text">
          {platform ? platform.displayName || platform.name : "ROMs"}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex border border-accent/50 p-0.5 text-[11px]"
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
                  "px-2.5 py-1 font-medium transition-colors",
                  filter === value
                    ? "bg-accent text-accent-fg"
                    : "text-muted hover:text-text",
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

      {visible.length === 0 &&
      !loadingMore &&
      !loadingAll &&
      !loadingDownloaded ? (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted">
          {listLoading ? "Loading…" : "No ROMs to show"}
        </div>
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-3">
          {viewMode === "list" ? (
            <RomList
              roms={visible}
              scrollRef={scrollRef}
              selectMode={selectMode}
              selectedIds={selectedIds}
              focusedId={focusedId}
              onCardClick={onCardClick}
              footer={footer}
            />
          ) : (
            <RomGrid
              roms={visible}
              scrollRef={scrollRef}
              selectMode={selectMode}
              selectedIds={selectedIds}
              focusedId={focusedId}
              onCardClick={onCardClick}
              footer={footer}
            />
          )}
        </div>
      )}
    </section>
  );
}
