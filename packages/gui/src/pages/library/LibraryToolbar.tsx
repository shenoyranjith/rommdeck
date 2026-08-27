import { cn } from "../../lib/cn";
import {
  IconLayoutGrid,
  IconLayoutList,
  IconSearch,
  IconSelectAll,
  IconSelectEmpty,
  IconSelectPartial,
} from "../../components/icons";
import type { LibraryViewMode } from "./types";

export type SelectionState = "none" | "partial" | "all";

export function LibraryToolbar({
  viewMode,
  onViewModeChange,
  searchInput,
  onSearchInputChange,
  selectMode,
  selectionState,
  hasSelection,
  hasPlatform,
  busyPlatform,
  busyKind,
  onSelectionButtonClick,
  onDownloadSelected,
  onDeleteSelected,
  onDownloadPlatform,
}: {
  viewMode: LibraryViewMode;
  onViewModeChange: (mode: LibraryViewMode) => void;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  selectMode: boolean;
  selectionState: SelectionState;
  hasSelection: boolean;
  hasPlatform: boolean;
  busyPlatform: boolean;
  busyKind: "platform" | "download" | "delete" | null;
  onSelectionButtonClick: () => void;
  onDownloadSelected: () => void;
  onDeleteSelected: () => void;
  onDownloadPlatform: () => void;
}) {
  const SelectIcon =
    selectionState === "all"
      ? IconSelectAll
      : selectionState === "partial"
        ? IconSelectPartial
        : IconSelectEmpty;

  const selectionLabel = !selectMode
    ? "Enter selection mode"
    : selectionState === "all"
      ? "Exit selection mode"
      : "Select all ROMs in platform";

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-[1.75rem] leading-none font-semibold tracking-wide text-text">
        Library
      </h1>
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex h-10 shrink-0 border border-accent p-0.5"
          role="group"
          aria-label="Library layout"
        >
          <button
            type="button"
            title="Grid view"
            aria-pressed={viewMode === "grid"}
            className={cn(
              "grid h-full w-9 place-items-center transition-colors",
              viewMode === "grid"
                ? "bg-accent text-accent-fg"
                : "text-text hover:bg-bg2",
            )}
            onClick={() => onViewModeChange("grid")}
          >
            <IconLayoutGrid className="size-4" strokeWidth={2.15} />
          </button>
          <button
            type="button"
            title="List view"
            aria-pressed={viewMode === "list"}
            className={cn(
              "grid h-full w-9 place-items-center transition-colors",
              viewMode === "list"
                ? "bg-accent text-accent-fg"
                : "text-text hover:bg-bg2",
            )}
            onClick={() => onViewModeChange("list")}
          >
            <IconLayoutList className="size-4" strokeWidth={2.15} />
          </button>
        </div>

        <label className="relative h-10 min-w-[240px] flex-1">
          <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-accent" />
          <input
            className="h-full w-full border border-accent bg-bg0 pr-3 pl-9 text-sm text-text outline-none placeholder:text-muted/80 focus:border-accent"
            placeholder="Search library…"
            title="Searches RomM for the selected platform (full catalog, not only cards on screen)"
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center border",
            selectMode
              ? "border-accent bg-accent text-accent-fg"
              : "border-accent/70 bg-bg0 text-text hover:border-accent",
          )}
          style={selectMode ? { boxShadow: "var(--glow)" } : undefined}
          onClick={onSelectionButtonClick}
          aria-label={selectionLabel}
          title={
            selectMode
              ? `${selectionLabel} (Esc to exit selection)`
              : selectionLabel
          }
        >
          <SelectIcon className="size-4" strokeWidth={2.15} />
        </button>
        {selectMode ? (
          <>
            <button
              type="button"
              className="h-10 shrink-0 cursor-pointer border border-accent bg-accent px-3 text-sm font-semibold text-accent-fg disabled:cursor-not-allowed disabled:opacity-40"
              style={{ boxShadow: "var(--glow)" }}
              disabled={!hasSelection || busyPlatform}
              onClick={onDownloadSelected}
            >
              {busyKind === "download" ? "Queuing…" : "Download selected"}
            </button>
            <button
              type="button"
              className="h-10 shrink-0 cursor-pointer border border-danger/50 bg-bg0 px-3 text-sm font-semibold text-danger disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!hasSelection || busyPlatform}
              onClick={onDeleteSelected}
            >
              {busyKind === "delete" ? "Deleting…" : "Delete selected"}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="h-10 shrink-0 cursor-pointer border border-accent bg-accent px-3 text-sm font-semibold text-accent-fg disabled:cursor-not-allowed disabled:opacity-40"
            style={{ boxShadow: "var(--glow)" }}
            disabled={!hasPlatform || busyPlatform}
            onClick={onDownloadPlatform}
          >
            {busyKind === "platform" ? "Queuing…" : "Download platform"}
          </button>
        )}
      </div>
    </div>
  );
}
