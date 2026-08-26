import { useCallback, useEffect, useMemo, useState } from "react";
import { getApi } from "../api";

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

  // Debounce search so we don't hit RomM on every keystroke
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

  // Clamp page if total shrinks (e.g. after platform switch race)
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
    if (total === 0) return "0";
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
    <div>
      <div className="page-header">
        <div>
          <h1>Library</h1>
          <p>Browse RomM platforms and download into RetroDECK folders.</p>
        </div>
        <div className="toolbar">
          <input
            placeholder="Search ROMs…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{
              background: "var(--bg1)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              color: "var(--text)",
              padding: "0.45rem 0.7rem",
              minWidth: 200,
            }}
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            style={{
              background: "var(--bg1)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              color: "var(--text)",
              padding: "0.45rem 0.7rem",
            }}
            title="Filter applies to the current page"
          >
            <option value="all">All on page</option>
            <option value="downloaded">Downloaded</option>
            <option value="missing">Missing</option>
          </select>
          <button className="btn" disabled={selectedIds.size === 0} onClick={() => void downloadSelected()}>
            Download selected
          </button>
          <button
            className="btn btn-primary"
            disabled={!selected || busyPlatform}
            onClick={() => void downloadPlatform()}
          >
            {busyPlatform ? "Queuing…" : "Download platform"}
          </button>
        </div>
      </div>

      {message && <div className="message ok">{message}</div>}
      {error && <div className="message err">{error}</div>}

      <div className="layout-split">
        <div className="panel">
          <div className="panel-title">Platforms</div>
          <ul className="platform-list">
            {platforms.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={selected?.id === p.id ? "active" : ""}
                  onClick={() => selectPlatform(p)}
                >
                  <span>{p.name}</span>
                  <span className="count">{p.rom_count ?? "—"}</span>
                </button>
              </li>
            ))}
            {platforms.length === 0 && <li className="empty">No platforms. Check Settings.</li>}
          </ul>
        </div>

        <div className="panel panel-roms">
          <div className="panel-title">
            {selected ? selected.name : "ROMs"}
            {loading ? " · loading…" : ` · ${rangeLabel}`}
          </div>
          {visible.length === 0 ? (
            <div className="empty">{loading ? "Loading…" : "No ROMs to show"}</div>
          ) : (
            <div className="rom-grid">
              {visible.map((rom) => {
                const cover = rom.coverUrl || rom.path_cover_small || rom.url_cover;
                const selectedCard = selectedIds.has(rom.id);
                return (
                  <article
                    key={rom.id}
                    className={`rom-card${selectedCard ? " selected" : ""}`}
                    onClick={() => toggleSelect(rom.id)}
                  >
                    <div className="rom-cover">
                      {cover ? <img src={cover} alt="" loading="lazy" /> : <span>No cover</span>}
                    </div>
                    <div className="rom-body">
                      <div className="rom-title">{rom.name}</div>
                      <span className={`badge ${rom.downloaded ? "badge-ok" : "badge-miss"}`}>
                        {rom.downloaded ? "Downloaded" : "Missing"}
                      </span>
                      <div className="rom-actions" onClick={(e) => e.stopPropagation()}>
                        {!rom.downloaded ? (
                          <button className="btn btn-primary" onClick={() => void downloadOne(rom)}>
                            Download
                          </button>
                        ) : (
                          <button className="btn btn-danger" onClick={() => void deleteLocal(rom)}>
                            Delete local
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="pagination">
            <button
              type="button"
              className="btn"
              disabled={loading || page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <span className="pagination-meta mono">
              Page {Math.min(page + 1, pageCount)} / {pageCount}
            </span>
            <button
              type="button"
              className="btn"
              disabled={loading || page + 1 >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
