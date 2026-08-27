import { memo, type ReactNode, type RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "../../lib/cn";
import { IconCheck, IconWarn } from "../../components/icons";
import type { RomItem } from "./types";

const ROW_HEIGHT = 72;

const RomListRow = memo(function RomListRow({
  rom,
  selectMode,
  selected,
  focused,
  onCardClick,
  onDownload,
  onDeleteLocal,
}: {
  rom: RomItem;
  selectMode: boolean;
  selected: boolean;
  focused: boolean;
  onCardClick: (rom: RomItem) => void;
  onDownload: (rom: RomItem) => void;
  onDeleteLocal: (rom: RomItem) => void;
}) {
  const cover = rom.coverUrl || rom.path_cover_small || rom.url_cover;
  const platformLabel =
    rom.platform_display_name || rom.platform_name || rom.platform_slug || "—";

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "flex h-full cursor-pointer items-center gap-3 border border-accent/70 bg-bg2 px-3 transition-colors",
        focused || selected
          ? "border-accent shadow-[var(--glow)]"
          : "hover:border-accent",
      )}
      onClick={() => onCardClick(rom)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardClick(rom);
        }
      }}
    >
      {selectMode && (
        <span
          className={cn(
            "grid size-5 shrink-0 place-items-center border",
            selected
              ? "border-accent bg-accent text-accent-fg"
              : "border-accent/50 text-transparent",
          )}
          aria-hidden
        >
          <IconCheck className="size-3.5" />
        </span>
      )}

      <div className="size-12 shrink-0 overflow-hidden border border-accent/40 bg-bg0">
        {cover ? (
          <img
            src={cover}
            alt=""
            decoding="async"
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center text-accent/70">
            <IconWarn className="size-4" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-text" title={rom.name}>
          {rom.name}
        </div>
        <div className="mt-0.5 truncate text-xs text-accent">{platformLabel}</div>
      </div>

      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold tracking-wide uppercase",
          rom.downloaded ? "text-accent" : "text-warn",
        )}
      >
        {rom.downloaded ? (
          <IconCheck className="size-3.5" />
        ) : (
          <IconWarn className="size-3.5" />
        )}
        {rom.downloaded ? "Downloaded" : "Missing"}
      </span>

      {!selectMode && (
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          {!rom.downloaded ? (
            <button
              type="button"
              className="h-8 border border-accent bg-accent/15 px-3 text-xs font-medium text-accent"
              onClick={() => onDownload(rom)}
            >
              Download
            </button>
          ) : (
            <button
              type="button"
              className="h-8 border border-danger/50 px-3 text-xs text-danger"
              onClick={() => onDeleteLocal(rom)}
            >
              Delete local
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export function RomList({
  roms,
  scrollRef,
  selectMode,
  selectedIds,
  focusedId,
  footer,
  onCardClick,
  onDownload,
  onDeleteLocal,
}: {
  roms: RomItem[];
  scrollRef: RefObject<HTMLDivElement | null>;
  selectMode: boolean;
  selectedIds: Set<number>;
  focusedId: number | null;
  footer?: ReactNode;
  onCardClick: (rom: RomItem) => void;
  onDownload: (rom: RomItem) => void;
  onDeleteLocal: (rom: RomItem) => void;
}) {
  const virtualizer = useVirtualizer({
    count: roms.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    getItemKey: (index) => roms[index]?.id ?? index,
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <>
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize(), contain: "layout paint" }}
      >
        {virtualRows.map((virtualRow) => {
          const rom = roms[virtualRow.index];
          if (!rom) return null;
          return (
            <div
              key={virtualRow.key}
              className="absolute top-0 left-0 w-full will-change-transform"
              style={{
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: 8,
              }}
            >
              <RomListRow
                rom={rom}
                selectMode={selectMode}
                selected={selectedIds.has(rom.id)}
                focused={!selectMode && focusedId === rom.id}
                onCardClick={onCardClick}
                onDownload={onDownload}
                onDeleteLocal={onDeleteLocal}
              />
            </div>
          );
        })}
      </div>
      {footer}
    </>
  );
}
