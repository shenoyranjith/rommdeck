import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { getApi } from "../api";
import { cn } from "../lib/cn";
import { IconCheck, IconClose, IconSearch, IconSelect } from "../components/icons";

const PAGE_SIZE = 48;

function formatBytes(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n;
  let i = -1;
  do {
    v /= 1024;
    i++;
  } while (v >= 1024 && i < units.length - 1);
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

/** Two-line clamped title; full name in a tooltip only when truncated. */
function RomName({ name }: { name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [truncated, setTruncated] = useState(false);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setTruncated(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [name]);

  return (
    <Tooltip.Root
      delayDuration={250}
      open={truncated && open}
      onOpenChange={(next) => {
        if (truncated) setOpen(next);
      }}
    >
      <Tooltip.Trigger asChild>
        <div
          ref={ref}
          className="h-[2.6em] overflow-hidden text-sm leading-[1.3] text-ellipsis text-text [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
        >
          {name}
        </div>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={6}
          className="z-50 max-w-xs rounded-md border border-line bg-bg2 px-2.5 py-1.5 text-xs leading-snug text-text shadow-lg"
        >
          {name}
          <Tooltip.Arrow className="fill-bg2" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

interface Platform {
  id: number;
  name: string;
  slug: string;
  rom_count?: number;
  logoUrl?: string | null;
  displayName?: string;
}

interface RomItem {
  id: number;
  name: string;
  platform_slug?: string;
  platform_name?: string;
  platform_display_name?: string;
  summary?: string | null;
  fs_name?: string;
  fs_size_bytes?: number;
  filesize?: number;
  files?: { file_name: string; file_size_bytes?: number }[];
  path_cover_small?: string | null;
  path_cover_large?: string | null;
  url_cover?: string | null;
  coverUrl?: string | null;
  coverUrlSmall?: string | null;
  downloaded?: boolean;
}

export function LibraryPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selected, setSelected] = useState<Platform | null>(null);
  const [roms, setRoms] = useState<RomItem[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<RomItem | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "downloaded" | "missing">("all");
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyPlatform, setBusyPlatform] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const queryIdRef = useRef(0);
  const detailQueryRef = useRef(0);
  const romsRef = useRef(roms);
  const totalRef = useRef(total);
  romsRef.current = roms;
  totalRef.current = total;

  const visiblePlatforms = useMemo(() => {
    if (showAllPlatforms) return platforms;
    return platforms.filter((p) => (p.rom_count ?? 0) > 0);
  }, [platforms, showAllPlatforms]);

  /** Status filters need the full platform/search result set (downloaded is local). */
  const needsFullCatalog = filter !== "all";
  const hasMore = !needsFullCatalog && roms.length < total;

  useEffect(() => {
    void (async () => {
      try {
        const list = (await getApi().getPlatforms()) as Platform[];
        setPlatforms(list);
        const withRoms = list.filter((p) => (p.rom_count ?? 0) > 0);
        setSelected(withRoms[0] ?? list[0] ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  // If the current selection is hidden by the filter, jump to the first visible platform.
  useEffect(() => {
    if (visiblePlatforms.length === 0) {
      if (selected) setSelected(null);
      return;
    }
    if (!selected || !visiblePlatforms.some((p) => p.id === selected.id)) {
      setSelected(visiblePlatforms[0]);
    }
  }, [visiblePlatforms, selected]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const resetAndLoad = useCallback(async () => {
    // Invalidate any in-flight loadMore from the previous query first.
    const qid = ++queryIdRef.current;
    // Drop previous list immediately so a deep scroll position can't keep
    // the load-more sentinel intersecting into the next platform/search.
    setRoms([]);
    setTotal(0);
    setSelectedIds(new Set());
    setSelectMode(false);
    setFocusedId(null);
    setDetail(null);
    setDetailError(null);
    setLoadingMore(false);
    setLoadingAll(false);
    setError(null);
    scrollRef.current?.scrollTo(0, 0);

    if (!selected && !search) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getApi().getRoms({
        platformId: selected?.id,
        platformSlug: selected?.slug,
        searchTerm: search || undefined,
        limit: PAGE_SIZE,
        offset: 0,
      });
      if (qid !== queryIdRef.current) return;
      setRoms(result.items as RomItem[]);
      setTotal(result.total ?? result.items.length);
      // Grid remounts after clear; pin to top once the first page is in.
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo(0, 0);
      });
    } catch (e) {
      if (qid !== queryIdRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
      setRoms([]);
      setTotal(0);
    } finally {
      if (qid === queryIdRef.current) setLoading(false);
    }
  }, [selected, search]);

  useEffect(() => {
    void resetAndLoad();
  }, [resetAndLoad]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMore || loadingAll) return;
    if (!selected && !search) return;
    const qid = queryIdRef.current;
    const offset = roms.length;
    setLoadingMore(true);
    setError(null);
    try {
      const result = await getApi().getRoms({
        platformId: selected?.id,
        platformSlug: selected?.slug,
        searchTerm: search || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      if (qid !== queryIdRef.current) return;
      const items = result.items as RomItem[];
      setRoms((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...items.filter((r) => !seen.has(r.id))];
      });
      setTotal(result.total ?? offset + items.length);
    } catch (e) {
      if (qid !== queryIdRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (qid === queryIdRef.current) setLoadingMore(false);
    }
  }, [hasMore, loading, loadingMore, loadingAll, roms.length, selected, search]);

  // Downloaded/Missing need every ROM for the current platform/search — page until done.
  useEffect(() => {
    if (!needsFullCatalog || loading) return;
    if (!selected && !search) return;
    if (totalRef.current > 0 && romsRef.current.length >= totalRef.current) {
      setLoadingAll(false);
      return;
    }

    const qid = queryIdRef.current;
    let cancelled = false;
    setLoadingAll(true);
    setError(null);

    void (async () => {
      try {
        while (!cancelled && qid === queryIdRef.current) {
          const offset = romsRef.current.length;
          const catalogTotal = totalRef.current;
          if (offset >= catalogTotal) break;

          const result = await getApi().getRoms({
            platformId: selected?.id,
            platformSlug: selected?.slug,
            searchTerm: search || undefined,
            limit: Math.max(PAGE_SIZE, 100),
            offset,
          });
          if (cancelled || qid !== queryIdRef.current) return;

          const items = result.items as RomItem[];
          const nextTotal = result.total ?? offset + items.length;
          setTotal(nextTotal);
          totalRef.current = nextTotal;

          setRoms((prev) => {
            const seen = new Set(prev.map((r) => r.id));
            const merged = [...prev, ...items.filter((r) => !seen.has(r.id))];
            romsRef.current = merged;
            return merged;
          });

          if (items.length === 0) break;
          if (romsRef.current.length >= nextTotal) break;
        }
      } catch (e) {
        if (!cancelled && qid === queryIdRef.current) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled && qid === queryIdRef.current) setLoadingAll(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [needsFullCatalog, loading, selected, search]);

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || needsFullCatalog) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { root, rootMargin: "240px" },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [loadMore, roms.length, loading, needsFullCatalog]);

  useEffect(() => {
    if (focusedId == null) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    const qid = ++detailQueryRef.current;
    setDetailError(null);
    // Card click already seeds `detail`; refresh in the background with no loading flash.
    void (async () => {
      try {
        const full = (await getApi().getRom(focusedId)) as RomItem;
        if (qid !== detailQueryRef.current) return;
        setDetail(full);
      } catch (e) {
        if (qid !== detailQueryRef.current) return;
        setDetailError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [focusedId]);

  const visible = useMemo(() => {
    return roms.filter((r) => {
      if (filter === "downloaded") return r.downloaded;
      if (filter === "missing") return !r.downloaded;
      return true;
    });
  }, [roms, filter]);

  const rangeLabel = useMemo(() => {
    if (loading && roms.length === 0) return "loading…";
    if (loadingAll) return `Loading ${roms.length} of ${total}…`;
    if (filter === "downloaded") {
      const n = roms.filter((r) => r.downloaded).length;
      return `${n} downloaded`;
    }
    if (filter === "missing") {
      const n = roms.filter((r) => !r.downloaded).length;
      return `${n} missing`;
    }
    if (total === 0) return "0 ROMs";
    return `${roms.length} of ${total}`;
  }, [roms, total, loading, loadingAll, filter]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const focusRom = (rom: RomItem) => {
    setFocusedId(rom.id);
    setDetail(rom);
  };

  const closeDetail = () => {
    setFocusedId(null);
    setDetail(null);
    setDetailError(null);
  };

  const toggleSelectMode = () => {
    setSelectMode((on) => {
      if (on) {
        setSelectedIds(new Set());
        return false;
      }
      closeDetail();
      return true;
    });
  };

  const onCardClick = (rom: RomItem) => {
    if (selectMode) toggleSelect(rom.id);
    else focusRom(rom);
  };

  const selectPlatform = (p: Platform) => {
    setSearchInput("");
    setSearch("");
    setSelected(p);
  };

  const downloadOne = async (rom: RomItem) => {
    const slug = rom.platform_slug ?? selected?.slug;
    if (!slug) return;
    await getApi().enqueueDownload(rom.id, slug);
    setMessage(`Queued ${rom.name}`);
  };

  const downloadSelected = async () => {
    const items = visible
      .filter((r) => selectedIds.has(r.id) && !r.downloaded)
      .map((r) => ({
        romId: r.id,
        platformSlug: r.platform_slug ?? selected!.slug,
      }));
    if (items.length === 0) return;
    await getApi().enqueueMany(items);
    setMessage(`Queued ${items.length} downloads`);
  };

  const downloadPlatform = async () => {
    if (!selected) return;
    setBusyPlatform(true);
    setError(null);
    try {
      const result = await getApi().enqueuePlatform(selected.id, selected.slug);
      if (result.queued === 0) {
        setMessage(
          result.skipped > 0
            ? `All ${result.skipped} ROMs already downloaded for ${selected.name}`
            : `No ROMs found for ${selected.name}`,
        );
      } else {
        setMessage(
          `Queued ${result.queued} of ${result.total} for ${selected.name}` +
            (result.skipped ? ` (${result.skipped} already local)` : ""),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyPlatform(false);
    }
  };

  const deleteLocal = async (rom: RomItem) => {
    if (!confirm(`Delete local files for "${rom.name}"? RomM is not touched.`)) return;
    await getApi().deleteLocal(rom.id);
    await resetAndLoad();
    setMessage(`Removed local copy of ${rom.name}`);
  };

  const detailSize =
    detail?.fs_size_bytes ??
    detail?.filesize ??
    detail?.files?.reduce((sum, f) => sum + (f.file_size_bytes ?? 0), 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-wide text-text">Library</h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[220px] flex-1">
            <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-accent" />
            <input
              className="w-full rounded-md border border-line bg-bg0 py-2 pr-3 pl-9 text-sm text-text outline-none placeholder:text-muted focus:border-accent"
              placeholder="Search this platform…"
              title="Searches RomM for the selected platform (full catalog, not only cards on screen)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm",
              selectMode
                ? "border-accent bg-accent text-accent-fg"
                : "border-line bg-bg2 text-text hover:border-accent/60",
            )}
            style={selectMode ? { boxShadow: "var(--glow)" } : undefined}
            onClick={toggleSelectMode}
            title={selectMode ? "Exit selection mode" : "Select ROMs for bulk download"}
          >
            <IconSelect className="size-4" />
            {selectMode ? (selectedIds.size > 0 ? `Selecting (${selectedIds.size})` : "Selecting") : "Select"}
          </button>
          {selectMode && (
            <button
              type="button"
              className="rounded-md border border-line bg-bg2 px-3 py-2 text-sm text-text disabled:opacity-40"
              disabled={selectedIds.size === 0}
              onClick={() => void downloadSelected()}
            >
              Download selected
            </button>
          )}
          <button
            type="button"
            className="rounded-md border border-accent bg-accent px-3 py-2 text-sm font-semibold text-accent-fg disabled:opacity-40"
            style={{ boxShadow: "var(--glow)" }}
            disabled={!selected || busyPlatform}
            onClick={() => void downloadPlatform()}
          >
            {busyPlatform ? "Queuing…" : "Download platform"}
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-md border border-ok/40 bg-bg2 px-3 py-2 text-sm text-ok">{message}</div>
      )}
      {error && (
        <div className="rounded-md border border-danger/40 bg-bg2 px-3 py-2 text-sm text-danger">{error}</div>
      )}

      <div
        className={cn(
          "grid min-h-0 flex-1 grid-cols-1 gap-3",
          focusedId != null
            ? "md:grid-cols-[200px_minmax(0,1fr)_minmax(280px,320px)]"
            : "md:grid-cols-[220px_1fr]",
        )}
      >
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-md border border-line bg-bg0/50">
          <div className="border-b border-line px-3 py-2">
            <div className="text-[11px] font-semibold tracking-[0.12em] text-accent uppercase">Platforms</div>
            <div className="mt-2 flex rounded-md border border-line p-0.5 text-[11px]">
              <button
                type="button"
                className={cn(
                  "flex-1 rounded px-2 py-1 font-medium transition-colors",
                  !showAllPlatforms ? "bg-accent text-accent-fg" : "text-muted hover:text-text",
                )}
                onClick={() => setShowAllPlatforms(false)}
              >
                With ROMs
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 rounded px-2 py-1 font-medium transition-colors",
                  showAllPlatforms ? "bg-accent text-accent-fg" : "text-muted hover:text-text",
                )}
                onClick={() => setShowAllPlatforms(true)}
              >
                All
              </button>
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-auto p-1.5">
            {visiblePlatforms.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm",
                    selected?.id === p.id
                      ? "bg-accent text-accent-fg"
                      : "text-text hover:bg-bg2",
                  )}
                  onClick={() => selectPlatform(p)}
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center overflow-hidden rounded border",
                      selected?.id === p.id ? "border-accent-fg/30 bg-accent-fg/10" : "border-line bg-bg0",
                    )}
                  >
                    {p.logoUrl ? (
                      <img src={p.logoUrl} alt="" className="size-full object-contain p-0.5" loading="lazy" />
                    ) : (
                      <span
                        className={cn(
                          "text-[9px] font-bold tracking-wide",
                          selected?.id === p.id ? "text-accent-fg/70" : "text-muted",
                        )}
                      >
                        {(p.displayName || p.name).slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.displayName || p.name}</span>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-xs",
                      selected?.id === p.id ? "text-accent-fg/80" : "text-accent",
                    )}
                  >
                    {p.rom_count ?? "—"}
                  </span>
                </button>
              </li>
            ))}
            {platforms.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted">No platforms. Check Settings.</li>
            )}
            {platforms.length > 0 && visiblePlatforms.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted">
                No platforms with ROMs. Switch to All to browse empty systems.
              </li>
            )}
          </ul>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-line bg-bg0/50">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2 text-sm">
            <span className="text-text">{selected ? selected.displayName || selected.name : "ROMs"}</span>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex rounded-md border border-line p-0.5 text-[11px]"
                title="Local download status for this platform (loads full catalog when needed)"
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
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="font-mono text-accent">{rangeLabel}</span>
            </div>
          </div>

          {visible.length === 0 && !loadingMore && !loadingAll ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted">
              {loading ? "Loading…" : "No ROMs to show"}
            </div>
          ) : (
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-3">
              <Tooltip.Provider delayDuration={250} skipDelayDuration={0}>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] items-start gap-3">
                {visible.map((rom) => {
                  const cover = rom.coverUrl || rom.path_cover_small || rom.url_cover;
                  const checked = selectedIds.has(rom.id);
                  const focused = !selectMode && focusedId === rom.id;
                  return (
                    <article
                      key={rom.id}
                      className={cn(
                        "relative flex cursor-pointer flex-col overflow-hidden rounded-md border bg-bg2 transition-colors",
                        focused
                          ? "border-accent shadow-[var(--glow)]"
                          : checked
                            ? "border-accent shadow-[var(--glow)]"
                            : "border-line hover:border-accent/60",
                      )}
                      onClick={() => onCardClick(rom)}
                    >
                      {selectMode && checked && (
                        <span
                          className="absolute top-2 right-2 z-10 grid size-7 place-items-center rounded-full border border-accent bg-accent text-accent-fg"
                          style={{ boxShadow: "var(--glow)" }}
                          aria-hidden
                        >
                          <IconCheck className="size-4" />
                        </span>
                      )}
                      <div className="grid aspect-[3/4] shrink-0 place-items-center bg-bg0 text-xs text-muted">
                        {cover ? (
                          <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-accent/80">NO COVER</span>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 p-2.5">
                        <RomName name={rom.name} />
                        <span
                          className={cn(
                            "inline-flex h-5 w-fit items-center rounded px-1.5 text-[10px] font-semibold tracking-wide uppercase",
                            rom.downloaded
                              ? "bg-ok/15 text-ok"
                              : "border border-warn/50 text-warn",
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
                                onClick={() => void downloadOne(rom)}
                              >
                                Download
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="h-8 flex-1 rounded border border-danger/50 px-2 text-xs text-danger"
                                onClick={() => void deleteLocal(rom)}
                              >
                                Delete local
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
              <div ref={sentinelRef} className="flex h-10 items-center justify-center text-xs text-muted">
                {loadingAll
                  ? `Loading catalog… ${roms.length}/${total || "…"}`
                  : loadingMore
                    ? "Loading more…"
                    : hasMore
                      ? null
                      : roms.length > 0 && filter === "all"
                        ? "End of list"
                        : null}
              </div>
              </Tooltip.Provider>
            </div>
          )}
        </section>

        {focusedId != null && (
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-md border border-line bg-bg0/50">
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
              <div className="text-[11px] font-semibold tracking-[0.12em] text-accent uppercase">Details</div>
              <button
                type="button"
                className="grid size-7 place-items-center rounded text-muted hover:bg-bg2 hover:text-text"
                onClick={closeDetail}
                aria-label="Close details"
              >
                <IconClose className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3">
              {!detail ? (
                <div className="py-10 text-center text-sm text-muted">
                  {detailError ?? "Loading…"}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="mx-auto w-full max-w-[220px] overflow-hidden rounded-md border border-line bg-bg0">
                    <div className="grid aspect-[3/4] place-items-center text-xs text-muted">
                      {detail.coverUrl || detail.coverUrlSmall || detail.path_cover_large || detail.path_cover_small || detail.url_cover ? (
                        <img
                          src={
                            detail.coverUrl ||
                            detail.coverUrlSmall ||
                            detail.path_cover_large ||
                            detail.path_cover_small ||
                            detail.url_cover ||
                            ""
                          }
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-accent/80">NO COVER</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold leading-snug text-text">{detail.name}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {detail.platform_display_name ||
                        detail.platform_name ||
                        selected?.displayName ||
                        selected?.name ||
                        detail.platform_slug ||
                        "—"}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                      detail.downloaded
                        ? "bg-ok/15 text-ok"
                        : "border border-warn/50 text-warn",
                    )}
                  >
                    {detail.downloaded ? "Downloaded" : "Missing"}
                  </span>

                  {detailError && (
                    <div className="rounded border border-danger/40 px-2 py-1.5 text-xs text-danger">
                      {detailError}
                    </div>
                  )}

                  {detail.summary ? (
                    <p className="text-sm leading-relaxed text-text/90 whitespace-pre-wrap">{detail.summary}</p>
                  ) : (
                    <p className="text-sm text-muted italic">No summary from RomM.</p>
                  )}

                  <dl className="grid gap-2 text-sm">
                    <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                      <dt className="text-muted">File</dt>
                      <dd className="min-w-0 truncate font-mono text-xs text-text" title={detail.fs_name}>
                        {detail.fs_name || "—"}
                      </dd>
                    </div>
                    <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                      <dt className="text-muted">Size</dt>
                      <dd className="font-mono text-xs text-text">{formatBytes(detailSize)}</dd>
                    </div>
                    {detail.files && detail.files.length > 1 && (
                      <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                        <dt className="text-muted">Parts</dt>
                        <dd className="font-mono text-xs text-text">{detail.files.length} files</dd>
                      </div>
                    )}
                  </dl>

                  <div className="mt-1 flex flex-col gap-2">
                    {!detail.downloaded ? (
                      <button
                        type="button"
                        className="rounded-md border border-accent bg-accent px-3 py-2 text-sm font-semibold text-accent-fg"
                        style={{ boxShadow: "var(--glow)" }}
                        onClick={() => void downloadOne(detail)}
                      >
                        Download
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rounded-md border border-danger/50 px-3 py-2 text-sm text-danger"
                        onClick={() => void deleteLocal(detail)}
                      >
                        Delete local
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
