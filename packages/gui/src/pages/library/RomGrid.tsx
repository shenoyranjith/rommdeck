import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "../../lib/cn";
import { IconCheck, IconWarn } from "../../components/icons";
import type { RomItem } from "./types";
import { romStatusClass, romStatusLabel } from "./romStatus";

const MIN_CARD_WIDTH = 150;
const GAP = 12;

export type RomGridItem = RomItem;

function columnsForWidth(width: number): number {
  if (width <= 0) return 1;
  return Math.max(1, Math.floor((width + GAP) / (MIN_CARD_WIDTH + GAP)));
}

/** Cover (3:4) + fixed body (title + status). */
function cardMetrics(cardWidth: number) {
  const cover = Math.ceil(cardWidth * (4 / 3));
  const body = 100;
  const height = cover + body;
  return { cover, body, height, row: height + GAP };
}

const RomCard = memo(function RomCard({
  rom,
  height,
  coverHeight,
  selectMode,
  selected,
  focused,
  onCardClick,
}: {
  rom: RomGridItem;
  height: number;
  coverHeight: number;
  selectMode: boolean;
  selected: boolean;
  focused: boolean;
  onCardClick: (rom: RomGridItem) => void;
}) {
  const cover = rom.coverUrl || rom.path_cover_small || rom.url_cover;
  return (
    <article
      className={cn(
        "relative flex w-full min-w-0 cursor-pointer flex-col overflow-hidden border bg-bg2",
        focused || selected
          ? "border-accent shadow-[var(--glow)]"
          : "border-accent/80 hover:border-accent",
      )}
      style={{ height }}
      onClick={() => onCardClick(rom)}
    >
      {selectMode && selected && (
        <span
          className="absolute top-2 right-2 z-10 grid size-7 place-items-center border border-accent bg-accent text-accent-fg"
          style={{ boxShadow: "var(--glow)" }}
          aria-hidden
        >
          <IconCheck className="size-4" />
        </span>
      )}
      <div
        className="grid w-full shrink-0 place-items-center overflow-hidden border-b border-accent/40 bg-bg0"
        style={{ height: coverHeight }}
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            decoding="async"
            draggable={false}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="grid h-full place-items-center gap-1 text-xs text-accent">
            <IconWarn className="size-5 opacity-80" />
            <span className="text-[10px] font-semibold tracking-wide">
              NO COVER
            </span>
          </div>
        )}
      </div>
      <div className="flex min-h-0 shrink-0 flex-col gap-2 p-2.5">
        <div
          className="h-[2.6em] overflow-hidden text-sm leading-[1.3] text-ellipsis text-text [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
          title={rom.name}
        >
          {rom.name}
        </div>
        <span
          className={cn(
            "inline-flex h-8 w-full items-center justify-center gap-1.5 border text-[10px] font-semibold tracking-wide uppercase",
            romStatusClass(rom),
          )}
        >
          {rom.downloaded && rom.verified !== false ? (
            <IconCheck className="size-3.5" />
          ) : (
            <IconWarn className="size-3.5" />
          )}
          {romStatusLabel(rom)}
        </span>
      </div>
    </article>
  );
});

export function RomGrid({
  roms,
  scrollRef,
  selectMode,
  selectedIds,
  focusedId,
  footer,
  onCardClick,
}: {
  roms: RomGridItem[];
  scrollRef: RefObject<HTMLDivElement | null>;
  selectMode: boolean;
  selectedIds: Set<number>;
  focusedId: number | null;
  footer?: ReactNode;
  onCardClick: (rom: RomGridItem) => void;
}) {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const next = el.clientWidth;
      setWidth((prev) => (prev === next ? prev : next));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollRef]);

  const cols = useMemo(() => columnsForWidth(width), [width]);
  const cardWidth =
    width <= 0 ? MIN_CARD_WIDTH : (width - GAP * (cols - 1)) / cols;
  const metrics = useMemo(() => cardMetrics(cardWidth), [cardWidth]);
  const estimate = metrics.row;
  const rowCount = cols > 0 ? Math.ceil(roms.length / cols) : 0;

  const estimateSize = useCallback(() => estimate, [estimate]);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan: 2,
    // Fixed row geometry — never remasure on data appends (that caused scroll jank).
    getItemKey: (index) => index,
  });

  // Only remasure when column geometry changes, not when more ROMs append.
  useLayoutEffect(() => {
    virtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimate, cols]);

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <>
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize(), contain: "layout paint" }}
      >
        {virtualRows.map((virtualRow) => {
          const start = virtualRow.index * cols;
          const rowRoms = roms.slice(start, start + cols);
          return (
            <div
              key={virtualRow.key}
              className="absolute top-0 left-0 w-full overflow-hidden will-change-transform"
              style={{
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                gap: GAP,
                alignContent: "start",
              }}
            >
              {rowRoms.map((rom) => (
                <RomCard
                  key={rom.id}
                  rom={rom}
                  height={metrics.height}
                  coverHeight={metrics.cover}
                  selectMode={selectMode}
                  selected={selectedIds.has(rom.id)}
                  focused={!selectMode && focusedId === rom.id}
                  onCardClick={onCardClick}
                />
              ))}
            </div>
          );
        })}
      </div>
      {footer}
    </>
  );
}
