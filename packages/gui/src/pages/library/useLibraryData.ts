import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApi } from "../../api";
import { catalogQueryFrom, fetchRomPage, mergeRomPages } from "./fetchCatalog";
import {
  catalogCacheKey,
  getCatalog,
  getDownloadedIds,
  getDownloadedRoms,
  invalidateDownloaded,
  markCatalogRomDownloaded,
  setCatalog,
  setDownloadedIds as cacheDownloadedIds,
  setDownloadedRoms as cacheDownloadedRoms,
} from "./romCache";
import type { Platform, RomItem, StatusFilter } from "./types";

export function useLibraryData() {
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
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadingDownloaded, setLoadingDownloaded] = useState(false);
  const [downloadedRoms, setDownloadedRoms] = useState<RomItem[]>([]);
  const [downloadedIds, setDownloadedIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyPlatform, setBusyPlatform] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const queryIdRef = useRef(0);
  const detailQueryRef = useRef(0);
  const downloadedQueryRef = useRef(0);
  const romsRef = useRef(roms);
  const totalRef = useRef(total);
  romsRef.current = roms;
  totalRef.current = total;

  const visiblePlatforms = useMemo(() => {
    if (showAllPlatforms) return platforms;
    return platforms.filter((p) => (p.rom_count ?? 0) > 0);
  }, [platforms, showAllPlatforms]);

  const needsFullCatalog = filter === "missing";
  const catalogMode = filter === "all" || filter === "missing";
  const hasMore = filter === "all" && roms.length < total;

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
    const qid = ++queryIdRef.current;
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
      setRoms([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    const key = catalogCacheKey(selected?.id, search);
    const cached = getCatalog(key);
    if (cached) {
      setRoms(cached.items);
      setTotal(cached.total);
      romsRef.current = cached.items;
      totalRef.current = cached.total;
      setLoading(false);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo(0, 0);
      });
      return;
    }

    setRoms([]);
    setTotal(0);
    setLoading(true);
    try {
      const { items, total: nextTotal } = await fetchRomPage(
        catalogQueryFrom(selected, search),
        {
          offset: 0,
        },
      );
      if (qid !== queryIdRef.current) return;
      setRoms(items);
      setTotal(nextTotal);
      romsRef.current = items;
      totalRef.current = nextTotal;
      setCatalog(key, items, nextTotal);
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
    if (filter === "downloaded") return;
    void resetAndLoad();
  }, [resetAndLoad, filter]);

  useEffect(() => {
    if (!selected?.slug) {
      setDownloadedIds(new Set());
      return;
    }
    const cached = getDownloadedIds(selected.slug);
    if (cached) {
      setDownloadedIds(new Set(cached));
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const ids = await getApi().downloadedIds(selected.slug);
        if (cancelled) return;
        cacheDownloadedIds(selected.slug, ids);
        setDownloadedIds(new Set(ids));
      } catch {
        if (!cancelled) setDownloadedIds(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.slug]);

  useEffect(() => {
    if (filter !== "downloaded" || !selected?.slug) {
      if (filter !== "downloaded") return;
      setDownloadedRoms([]);
      return;
    }
    const slug = selected.slug;
    const cached = getDownloadedRoms(slug);
    if (cached) {
      setDownloadedRoms(cached);
      setDownloadedIds(new Set(cached.map((r) => r.id)));
      setLoadingDownloaded(false);
      scrollRef.current?.scrollTo(0, 0);
      return;
    }

    const qid = ++downloadedQueryRef.current;
    setLoadingDownloaded(true);
    setError(null);
    scrollRef.current?.scrollTo(0, 0);
    void (async () => {
      try {
        const items = (await getApi().getDownloadedRoms(slug)) as RomItem[];
        if (qid !== downloadedQueryRef.current) return;
        cacheDownloadedRoms(slug, items);
        setDownloadedRoms(items);
        setDownloadedIds(new Set(items.map((r) => r.id)));
      } catch (e) {
        if (qid !== downloadedQueryRef.current) return;
        setError(e instanceof Error ? e.message : String(e));
        setDownloadedRoms([]);
      } finally {
        if (qid === downloadedQueryRef.current) setLoadingDownloaded(false);
      }
    })();
  }, [filter, selected?.slug]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMore || loadingAll) return;
    if (!selected && !search) return;
    const qid = queryIdRef.current;
    const key = catalogCacheKey(selected?.id, search);
    const offset = roms.length;
    setLoadingMore(true);
    setError(null);
    try {
      const { items, total: nextTotal } = await fetchRomPage(
        catalogQueryFrom(selected, search),
        {
          offset,
        },
      );
      if (qid !== queryIdRef.current) return;
      setRoms((prev) => {
        const merged = mergeRomPages(prev, items);
        romsRef.current = merged;
        setCatalog(key, merged, nextTotal);
        return merged;
      });
      setTotal(nextTotal);
      totalRef.current = nextTotal;
    } catch (e) {
      if (qid !== queryIdRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (qid === queryIdRef.current) setLoadingMore(false);
    }
  }, [
    hasMore,
    loading,
    loadingMore,
    loadingAll,
    roms.length,
    selected,
    search,
  ]);

  useEffect(() => {
    if (!needsFullCatalog || loading) return;
    if (!selected && !search) return;
    if (totalRef.current > 0 && romsRef.current.length >= totalRef.current) {
      setLoadingAll(false);
      return;
    }

    const qid = queryIdRef.current;
    const key = catalogCacheKey(selected?.id, search);
    const query = catalogQueryFrom(selected, search);
    let cancelled = false;
    setLoadingAll(true);
    setError(null);

    void (async () => {
      try {
        while (!cancelled && qid === queryIdRef.current) {
          const offset = romsRef.current.length;
          const catalogTotal = totalRef.current;
          if (offset >= catalogTotal) break;

          const { items, total: nextTotal } = await fetchRomPage(query, {
            limit: 100,
            offset,
          });
          if (cancelled || qid !== queryIdRef.current) return;

          setTotal(nextTotal);
          totalRef.current = nextTotal;

          setRoms((prev) => {
            const merged = mergeRomPages(prev, items);
            romsRef.current = merged;
            setCatalog(key, merged, nextTotal);
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

  const visible = useMemo(() => {
    if (filter === "downloaded") {
      if (!search) return downloadedRoms;
      const q = search.toLowerCase();
      return downloadedRoms.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.fs_name?.toLowerCase().includes(q) ?? false),
      );
    }
    if (filter === "missing") {
      return roms.filter((r) => !downloadedIds.has(r.id));
    }
    return roms;
  }, [filter, roms, downloadedRoms, downloadedIds, search]);

  const gridEmpty = visible.length === 0;
  const listLoading =
    (filter === "downloaded" && loadingDownloaded) ||
    (catalogMode && loading && roms.length === 0);

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || filter !== "all" || gridEmpty) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { root, rootMargin: "240px" },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [loadMore, loading, filter, gridEmpty]);

  useEffect(() => {
    if (focusedId == null) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    const qid = ++detailQueryRef.current;
    setDetailError(null);
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

  const rangeLabel = useMemo(() => {
    if (listLoading) return "loading…";
    if (filter === "downloaded") {
      return search
        ? `${visible.length} of ${downloadedRoms.length} downloaded`
        : `${downloadedRoms.length} downloaded`;
    }
    if (loadingAll) return `Loading ${roms.length} of ${total}…`;
    if (filter === "missing") {
      return loadingAll
        ? `Loading ${roms.length} of ${total}…`
        : `${visible.length} missing`;
    }
    if (total === 0) return "0 ROMs";
    return `${roms.length} of ${total}`;
  }, [
    listLoading,
    filter,
    search,
    visible.length,
    downloadedRoms.length,
    loadingAll,
    roms.length,
    total,
  ]);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const focusRom = useCallback((rom: RomItem) => {
    setFocusedId(rom.id);
    setDetail(rom);
  }, []);

  const closeDetail = useCallback(() => {
    setFocusedId(null);
    setDetail(null);
    setDetailError(null);
  }, []);

  const toggleSelectMode = useCallback(() => {
    setSelectMode((on) => {
      if (on) {
        setSelectedIds(new Set());
        return false;
      }
      setFocusedId(null);
      setDetail(null);
      setDetailError(null);
      return true;
    });
  }, []);

  const onCardClick = useCallback(
    (rom: RomItem) => {
      if (selectMode) toggleSelect(rom.id);
      else focusRom(rom);
    },
    [selectMode, toggleSelect, focusRom],
  );

  const selectPlatform = useCallback((p: Platform) => {
    setSearchInput("");
    setSearch("");
    setSelected(p);
  }, []);

  const downloadOne = useCallback(
    async (rom: RomItem) => {
      const slug = rom.platform_slug ?? selected?.slug;
      if (!slug) return;
      await getApi().enqueueDownload(rom.id, slug);
      setMessage(`Queued ${rom.name}`);
    },
    [selected?.slug],
  );

  const deleteLocal = useCallback(
    async (rom: RomItem) => {
      if (
        !confirm(`Delete local files for "${rom.name}"? RomM is not touched.`)
      )
        return;
      await getApi().deleteLocal(rom.id);
      const slug = rom.platform_slug ?? selected?.slug;
      if (slug) invalidateDownloaded(slug);
      markCatalogRomDownloaded(selected?.id, rom.id, false);
      setDownloadedIds((prev) => {
        const next = new Set(prev);
        next.delete(rom.id);
        return next;
      });
      setDownloadedRoms((prev) => {
        const next = prev.filter((r) => r.id !== rom.id);
        if (slug) cacheDownloadedRoms(slug, next);
        return next;
      });
      setRoms((prev) => {
        const next = prev.map((r) =>
          r.id === rom.id ? { ...r, downloaded: false } : r,
        );
        if (selected)
          setCatalog(
            catalogCacheKey(selected.id, search),
            next,
            totalRef.current,
          );
        return next;
      });
      if (detail?.id === rom.id) setDetail({ ...rom, downloaded: false });
      setMessage(`Removed local copy of ${rom.name}`);
    },
    [detail?.id, selected, search],
  );

  const downloadSelected = useCallback(async () => {
    const items = visible
      .filter((r) => selectedIds.has(r.id) && !r.downloaded)
      .map((r) => ({
        romId: r.id,
        platformSlug: r.platform_slug ?? selected!.slug,
      }));
    if (items.length === 0) return;
    await getApi().enqueueMany(items);
    setMessage(`Queued ${items.length} downloads`);
  }, [visible, selectedIds, selected]);

  const downloadPlatform = useCallback(async () => {
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
  }, [selected]);

  return {
    platforms,
    visiblePlatforms,
    selected,
    searchInput,
    setSearchInput,
    selectedIds,
    selectMode,
    focusedId,
    detail,
    detailError,
    filter,
    setFilter,
    showAllPlatforms,
    setShowAllPlatforms,
    loadingMore,
    loadingAll,
    loadingDownloaded,
    roms,
    total,
    hasMore,
    visible,
    listLoading,
    rangeLabel,
    error,
    message,
    busyPlatform,
    scrollRef,
    sentinelRef,
    selectPlatform,
    toggleSelectMode,
    onCardClick,
    closeDetail,
    downloadOne,
    deleteLocal,
    downloadSelected,
    downloadPlatform,
  };
}
