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
import { IconCheck } from "../../components/icons";

const MIN_CARD_WIDTH = 150;
const GAP = 12;

export interface RomGridItem {
  id: number;
  name: string;
  coverUrl?: string | null;
  path_cover_small?: string | null;
  url_cover?: string | null;
  downloaded?: boolean;
}

function columnsForWidth(width: number): number {
  if (width <= 0) return 1;
  return Math.max(1, Math.floor((width + GAP) / (MIN_CARD_WIDTH + GAP)));
}

/** Cover (3:4) + fixed body (title, badge, optional action). */
function rowHeight(cardWidth: number, selectMode: boolean): number {
  const cover = cardWidth * (4 / 3);
  const body = selectMode ? 88 : 128;
  return Math.ceil(cover + body + GAP);
}

const RomCard = memo(function RomCard({
  rom,
  selectMode,
  selected,
  focused,
  onCardClick,
  onDownload,
  onDeleteLocal,
}: {
  rom: RomGridItem;
  selectMode: boolean;
  selected: boolean;
  focused: boolean;
  onCardClick: (rom: RomGridItem) => void;
  onDownload: (rom: RomGridItem) => void;
  onDeleteLocal: (rom: RomGridItem) => void;
}) {
  const cover = rom.coverUrl || rom.path_cover_small || rom.url_cover;
  return (
    <article
      className={cn(
        "relative flex cursor-pointer flex-col overflow-hidden rounded-md border bg-bg2",
        focused || selected
          ? "border-accent shadow-[var(--glow)]"
          : "border-line hover:border-accent/60",
      )}
      onClick={() => onCardClick(rom)}
    >
      {selectMode && selected && (
        <span
          className="absolute top-2 right-2 z-10 grid size-7 place-items-center rounded-full border border-accent bg-accent text-accent-fg"
          style={{ boxShadow: "var(--glow)" }}
          aria-hidden
        >
          <IconCheck className="size-4" />
        </span>
      )}
      <div className="aspect-[3/4] shrink-0 bg-bg0 text-xs text-muted">
        {cover ? (
          <img
            src={cover}
            alt=""
            decoding="async"
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center">
            <span className="text-accent/80">NO COVER</span>
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-2 p-2.5">
        <div
          className="h-[2.6em] overflow-hidden text-sm leading-[1.3] text-ellipsis text-text [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
          title={rom.name}
        >
          {rom.name}
        </div>
        <span
          className={cn(
            "inline-flex h-5 w-fit items-center rounded px-1.5 text-[10px] font-semibold tracking-wide uppercase",
            rom.downloaded ? "bg-ok/15 text-ok" : "border border-warn/50 text-warn",
          )}
        >
          {rom.downloaded ? "Downloaded" : "Missing"}
        </span>
        {!selectMode && (
          <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
            {!rom.downloaded ? (
              <button
                type="button"
                className="h-8 flex-1 rounded border border-accent bg-accent/15 px-2 text-xs font-medium text-accent"
                onClick={() => onDownload(rom)}
              >
                Download
              </button>
            ) : (
              <button
                type="button"
                className="h-8 flex-1 rounded border border-danger/50 px-2 text-xs text-danger"
                onClick={() => onDeleteLocal(rom)}
              >
                Delete local
              </button>
            )}
          </div>
        )}
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
  onDownload,
  onDeleteLocal,
}: {
  roms: RomGridItem[];
  scrollRef: RefObject<HTMLDivElement | null>;
  selectMode: boolean;
  selectedIds: Set<number>;
  focusedId: number | null;
  footer?: ReactNode;
  onCardClick: (rom: RomGridItem) => void;
  onDownload: (rom: RomGridItem) => void;
  onDeleteLocal: (rom: RomGridItem) => void;
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
  const cardWidth = width <= 0 ? MIN_CARD_WIDTH : (width - GAP * (cols - 1)) / cols;
  const estimate = useMemo(
    () => rowHeight(cardWidth, selectMode),
    [cardWidth, selectMode],
  );
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
              className="absolute top-0 left-0 w-full will-change-transform"
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
                  selectMode={selectMode}
                  selected={selectedIds.has(rom.id)}
                  focused={!selectMode && focusedId === rom.id}
                  onCardClick={onCardClick}
                  onDownload={onDownload}
                  onDeleteLocal={onDeleteLocal}
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
