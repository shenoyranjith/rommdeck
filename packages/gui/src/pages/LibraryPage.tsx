import { useCallback, useEffect, useMemo, useState } from "react";
import { getApi } from "../api";
import { cn } from "../lib/cn";
import { IconSearch } from "../components/icons";

const PAGE_SIZE = 48;

interface Platform {
  id: number;
  name: string;
  slug: string;
  rom_count?: number;
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
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<"all" | "downloaded" | "missing">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyPlatform, setBusyPlatform] = useState(false);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    void (async () => {
      try {
        const list = (await getApi().getPlatforms()) as Platform[];
        setPlatforms(list);
        if (list[0]) setSelected(list[0]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadRoms = useCallback(async () => {
    if (!selected && !search) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getApi().getRoms({
        platformId: selected?.id,
        platformSlug: selected?.slug,
        searchTerm: search || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setRoms(result.items as RomItem[]);
      setTotal(result.total ?? result.items.length);
      setSelectedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selected, search, page]);

  useEffect(() => {
    void loadRoms();
  }, [loadRoms]);

  useEffect(() => {
    if (page > 0 && page >= pageCount) {
      setPage(pageCount - 1);
    }
  }, [page, pageCount]);

  const visible = useMemo(() => {
    return roms.filter((r) => {
      if (filter === "downloaded") return r.downloaded;
      if (filter === "missing") return !r.downloaded;
      return true;
    });
  }, [roms, filter]);

  const rangeLabel = useMemo(() => {
    if (total === 0) return "0 ROMs";
    const from = page * PAGE_SIZE + 1;
    const to = Math.min(total, (page + 1) * PAGE_SIZE);
    return `${from}–${to} of ${total}`;
  }, [page, total]);

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
    setPage(0);
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
    await loadRoms();
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
            title="Filter applies to the current page"
          >
            <option value="all">All on page</option>
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
          <div className="border-b border-line px-3 py-2 text-[11px] font-semibold tracking-[0.12em] text-accent uppercase">
            Platforms
          </div>
          <ul className="min-h-0 flex-1 overflow-auto p-1.5">
            {platforms.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm",
                    selected?.id === p.id
                      ? "bg-accent text-accent-fg"
                      : "text-text hover:bg-bg2",
                  )}
                  onClick={() => selectPlatform(p)}
                >
                  <span className="truncate">{p.name}</span>
                  <span
                    className={cn(
                      "font-mono text-xs",
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
          </ul>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-line bg-bg0/50">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2 text-sm">
            <span className="text-text">{selected ? selected.name : "ROMs"}</span>
            <span className="font-mono text-accent">{loading ? "loading…" : rangeLabel}</span>
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted">
              {loading ? "Loading…" : "No ROMs to show"}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto p-3">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
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
                      <div className="grid aspect-[3/4] place-items-center bg-bg0 text-xs text-muted">
                        {cover ? (
                          <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-accent/80">NO COVER</span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-2.5">
                        <div className="line-clamp-2 min-h-[2.4em] text-sm leading-snug text-text">{rom.name}</div>
                        <span
                          className={cn(
                            "inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                            rom.downloaded
                              ? "bg-ok/15 text-ok"
                              : "border border-warn/50 text-warn",
                          )}
                        >
                          {rom.downloaded ? "Downloaded" : "Missing"}
                        </span>
                        <div className="mt-auto flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {!rom.downloaded ? (
                            <button
                              type="button"
                              className="flex-1 rounded border border-accent bg-accent/15 px-2 py-1.5 text-xs font-medium text-accent"
                              onClick={() => void downloadOne(rom)}
                            >
                              Download
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="flex-1 rounded border border-danger/50 px-2 py-1.5 text-xs text-danger"
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
            </div>
          )}

          <div className="flex items-center justify-center gap-4 border-t border-line px-3 py-2">
            <button
              type="button"
              className="rounded-md border border-line px-3 py-1.5 text-sm text-text disabled:opacity-40"
              disabled={loading || page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <span className="min-w-24 text-center font-mono text-xs text-muted">
              Page {Math.min(page + 1, pageCount)} / {pageCount}
            </span>
            <button
              type="button"
              className="rounded-md border border-line px-3 py-1.5 text-sm text-text disabled:opacity-40"
              disabled={loading || page + 1 >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
