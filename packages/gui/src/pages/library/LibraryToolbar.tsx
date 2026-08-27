import { cn } from "../../lib/cn";
import { IconSearch, IconSelect } from "../../components/icons";

export function LibraryToolbar({
  searchInput,
  onSearchInputChange,
  selectMode,
  selectedCount,
  hasPlatform,
  busyPlatform,
  onToggleSelectMode,
  onDownloadSelected,
  onDownloadPlatform,
}: {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  selectMode: boolean;
  selectedCount: number;
  hasPlatform: boolean;
  busyPlatform: boolean;
  onToggleSelectMode: () => void;
  onDownloadSelected: () => void;
  onDownloadPlatform: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-[1.75rem] leading-none font-semibold tracking-wide text-text">
        Library
      </h1>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[240px] flex-1">
          <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-accent" />
          <input
            className="w-full border border-accent bg-bg0 py-2 pr-3 pl-9 text-sm text-text outline-none placeholder:text-muted/80 focus:border-accent"
            placeholder="Search library…"
            title="Searches RomM for the selected platform (full catalog, not only cards on screen)"
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 border px-3 py-2 text-sm",
            selectMode
              ? "border-accent bg-accent text-accent-fg"
              : "border-accent/70 bg-bg0 text-text hover:border-accent",
          )}
          style={selectMode ? { boxShadow: "var(--glow)" } : undefined}
          onClick={onToggleSelectMode}
          title={
            selectMode ? "Exit selection mode" : "Select ROMs for bulk download"
          }
        >
          <IconSelect className="size-4" />
          {selectMode
            ? selectedCount > 0
              ? `Selecting (${selectedCount})`
              : "Selecting"
            : "Select"}
        </button>
        {selectMode && (
          <button
            type="button"
            className="border border-accent/70 bg-bg0 px-3 py-2 text-sm text-text disabled:opacity-40"
            disabled={selectedCount === 0}
            onClick={onDownloadSelected}
          >
            Download selected
          </button>
        )}
        <button
          type="button"
          className="border border-accent bg-accent px-3 py-2 text-sm font-semibold text-accent-fg disabled:opacity-40"
          style={{ boxShadow: "var(--glow)" }}
          disabled={!hasPlatform || busyPlatform}
          onClick={onDownloadPlatform}
        >
          {busyPlatform ? "Queuing…" : "Download platform"}
        </button>
      </div>
    </div>
  );
}
