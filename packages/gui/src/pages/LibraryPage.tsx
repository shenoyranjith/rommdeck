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
import { IconSearch } from "../components/icons";

const PAGE_SIZE = 48;

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
  path_cover_small?: string | null;
  url_cover?: string | null;
  coverUrl?: string | null;
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
  const [filter, setFilter] = useState<"all" | "downloaded" | "missing">("all");
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyPlatform, setBusyPlatform] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const queryIdRef = useRef(0);

  const visiblePlatforms = useMemo(() => {
    if (showAllPlatforms) return platforms;
    return platforms.filter((p) => (p.rom_count ?? 0) > 0);
  }, [platforms, showAllPlatforms]);

  const hasMore = roms.length < total;

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
    setLoadingMore(false);
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
    if (!hasMore || loading || loadingMore) return;
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
  }, [hasMore, loading, loadingMore, roms.length, selected, search]);

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { root, rootMargin: "240px" },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [loadMore, roms.length, loading]);

  const visible = useMemo(() => {
    return roms.filter((r) => {
      if (filter === "downloaded") return r.downloaded;
      if (filter === "missing") return !r.downloaded;
      return true;
    });
  }, [roms, filter]);

  const rangeLabel = useMemo(() => {
    if (total === 0 && !loading) return "0 ROMs";
    if (loading && roms.length === 0) return "loading…";
    return `${roms.length} of ${total} loaded`;
  }, [roms.length, total, loading]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-wide text-text">Library</h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[200px] flex-1">
            <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-accent" />
            <input
              className="w-full rounded-md border border-line bg-bg0 py-2 pr-3 pl-9 text-sm text-text outline-none placeholder:text-muted focus:border-accent"
              placeholder="Search library…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </label>
          <select
            className="rounded-md border border-line bg-bg0 px-3 py-2 text-sm text-text outline-none focus:border-accent"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            title="Filter applies to currently loaded ROMs"
          >
            <option value="all">All loaded</option>
            <option value="downloaded">Downloaded</option>
            <option value="missing">Missing</option>
          </select>
          <button
            type="button"
            className="rounded-md border border-line bg-bg2 px-3 py-2 text-sm text-text disabled:opacity-40"
            disabled={selectedIds.size === 0}
            onClick={() => void downloadSelected()}
          >
            Download selected
          </button>
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

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
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
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2 text-sm">
            <span className="text-text">{selected ? selected.displayName || selected.name : "ROMs"}</span>
            <span className="font-mono text-accent">{rangeLabel}</span>
          </div>

          {visible.length === 0 && !loadingMore ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted">
              {loading ? "Loading…" : "No ROMs to show"}
            </div>
          ) : (
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-3">
              <Tooltip.Provider delayDuration={250} skipDelayDuration={0}>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] items-start gap-3">
                {visible.map((rom) => {
                  const cover = rom.coverUrl || rom.path_cover_small || rom.url_cover;
                  const selectedCard = selectedIds.has(rom.id);
                  return (
                    <article
                      key={rom.id}
                      className={cn(
                        "flex cursor-pointer flex-col overflow-hidden rounded-md border bg-bg2 transition-colors",
                        selectedCard ? "border-accent shadow-[var(--glow)]" : "border-line hover:border-accent/60",
                      )}
                      onClick={() => toggleSelect(rom.id)}
                    >
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
                      </div>
                    </article>
                  );
                })}
              </div>
              <div ref={sentinelRef} className="flex h-10 items-center justify-center text-xs text-muted">
                {loadingMore ? "Loading more…" : hasMore ? null : roms.length > 0 ? "End of list" : null}
              </div>
              </Tooltip.Provider>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
