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
  onInventoryChange,
  setCatalog,
  setDownloadedIds as cacheDownloadedIds,
  setDownloadedRoms as cacheDownloadedRoms,
} from "./romCache";
import type { Platform, RomItem, StatusFilter } from "./types";
import { useActiveDownloads } from "../../hooks/useActiveDownloads";
import { useConfirm } from "../../components/ConfirmProvider";

export function useLibraryData() {
  const activeDownloads = useActiveDownloads();
  const confirm = useConfirm();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selected, setSelected] = useState<Platform | null>(null);
  const [roms, setRoms] = useState<RomItem[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  /** When true, every ROM in the current platform query is selected (lazy; IDs filled as rows load). */
  const [selectAll, setSelectAll] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const selectAllRef = useRef(false);
  selectAllRef.current = selectAll;
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
  const [busyKind, setBusyKind] = useState<
    "platform" | "download" | "delete" | null
  >(null);
  const busyPlatform = busyKind !== null;

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

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectAll(false);
    setSelectedIds(new Set());
  }, []);

  const resetAndLoad = useCallback(async () => {
    const qid = ++queryIdRef.current;
    setSelectedIds(new Set());
    setSelectAll(false);
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
    setSelectAll(false);
    setSelectedIds(new Set());
    setSelectMode(false);
  }, [filter]);

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
    return onInventoryChange((event) => {
      if (selected?.slug === event.rommSlug) {
        setDownloadedIds((prev) => {
          const next = new Set(prev);
          if (event.downloaded) next.add(event.romId);
          else next.delete(event.romId);
          return next;
        });
      }

      setRoms((prev) => {
        if (!prev.some((r) => r.id === event.romId)) return prev;
        const next = prev.map((r) =>
          r.id === event.romId
            ? {
                ...r,
                downloaded: event.downloaded,
                verified: event.downloaded ? event.verified : undefined,
              }
            : r,
        );
        if (selected) {
          setCatalog(
            catalogCacheKey(selected.id, search),
            next,
            totalRef.current,
          );
        }
        return next;
      });

      setDownloadedRoms((prev) => {
        if (event.downloaded) return prev;
        return prev.filter((r) => r.id !== event.romId);
      });

      setDetail((prev) => {
        if (prev?.id !== event.romId) return prev;
        return {
          ...prev,
          downloaded: event.downloaded,
          verified: event.downloaded ? event.verified : undefined,
        };
      });
    });
  }, [selected?.id, selected?.slug, search]);

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
      if (selectAllRef.current) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const rom of items) next.add(rom.id);
          return next;
        });
      }
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

          if (selectAllRef.current && items.length > 0) {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              for (const rom of items) next.add(rom.id);
              return next;
            });
          }

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

  const selectionTotal = useMemo(() => {
    if (filter === "downloaded") return visible.length;
    return total;
  }, [filter, visible.length, total]);

  /** IDs shown as selected in the grid/list (select-all covers every currently loaded row). */
  const displaySelectedIds = useMemo(() => {
    if (selectAll) return new Set(visible.map((r) => r.id));
    return selectedIds;
  }, [selectAll, visible, selectedIds]);

  const selectionState = useMemo(() => {
    if (!selectMode) return "none" as const;
    if (selectAll) return "all" as const;
    if (selectedIds.size === 0) return "none" as const;
    if (selectionTotal > 0 && selectedIds.size >= selectionTotal)
      return "all" as const;
    return "partial" as const;
  }, [selectMode, selectAll, selectedIds.size, selectionTotal]);

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

  const toggleSelect = useCallback(
    (id: number) => {
      if (selectAllRef.current) {
        setSelectAll(false);
        setSelectedIds(
          new Set(visible.filter((r) => r.id !== id).map((r) => r.id)),
        );
        return;
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [visible],
  );

  const focusRom = useCallback((rom: RomItem) => {
    setFocusedId(rom.id);
    setDetail(rom);
  }, []);

  const closeDetail = useCallback(() => {
    setFocusedId(null);
    setDetail(null);
    setDetailError(null);
  }, []);

  const enterSelectMode = useCallback(() => {
    setSelectMode(true);
    setSelectAll(false);
    setSelectedIds(new Set());
    setFocusedId(null);
    setDetail(null);
    setDetailError(null);
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectAll || (selectionTotal > 0 && selectedIds.size >= selectionTotal)) {
      exitSelectMode();
      return;
    }
    setSelectAll(true);
    setSelectedIds(new Set(visible.map((r) => r.id)));
  }, [
    selectAll,
    selectionTotal,
    selectedIds.size,
    visible,
    exitSelectMode,
  ]);

  const onSelectionButtonClick = useCallback(() => {
    if (!selectMode) {
      enterSelectMode();
      return;
    }
    toggleSelectAll();
  }, [selectMode, enterSelectMode, toggleSelectAll]);

  useEffect(() => {
    if (!selectMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitSelectMode();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectMode, exitSelectMode]);

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
      const queueStatus = activeDownloads.get(rom.id);
      if (queueStatus) return;
      await getApi().enqueueDownload(rom.id, slug);
      setMessage(`Queued ${rom.name}`);
    },
    [selected?.slug, activeDownloads],
  );

  const deleteLocal = useCallback(
    async (rom: RomItem) => {
      const ok = await confirm({
        title: "Delete local files",
        message: `Delete local files for "${rom.name}"?`,
        hint: "RomM is not touched.",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        tone: "danger",
      });
      if (!ok) return;
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
    [detail?.id, selected, search, confirm],
  );

  const applyDeletedIds = useCallback(
    (ids: number[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      const slug = selected?.slug;
      if (slug) invalidateDownloaded(slug);
      for (const id of ids) markCatalogRomDownloaded(selected?.id, id, false);
      setDownloadedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      setDownloadedRoms((prev) => {
        const next = prev.filter((r) => !idSet.has(r.id));
        if (slug) cacheDownloadedRoms(slug, next);
        return next;
      });
      setRoms((prev) => {
        const next = prev.map((r) =>
          idSet.has(r.id) ? { ...r, downloaded: false } : r,
        );
        if (selected)
          setCatalog(
            catalogCacheKey(selected.id, search),
            next,
            totalRef.current,
          );
        return next;
      });
      if (detail && idSet.has(detail.id)) {
        setDetail({ ...detail, downloaded: false });
      }
    },
    [selected, search, detail],
  );

  const deleteSelected = useCallback(async () => {
    if (!selected) return;

    let ids: number[] = [];

    if (selectAll) {
      if (filter === "missing") {
        setMessage("No local files in the current selection");
        return;
      }
      if (filter === "downloaded") {
        ids = visible.map((r) => r.id);
      } else if (!search) {
        ids = Array.from(downloadedIds);
      } else {
        const query = catalogQueryFrom(selected, search);
        let offset = 0;
        let catalogTotal = Infinity;
        while (offset < catalogTotal) {
          const page = await fetchRomPage(query, { limit: 100, offset });
          catalogTotal = page.total;
          for (const rom of page.items) {
            if (rom.downloaded || downloadedIds.has(rom.id)) ids.push(rom.id);
          }
          offset += page.items.length;
          if (page.items.length === 0) break;
        }
      }
    } else {
      ids = visible
        .filter((r) => selectedIds.has(r.id) && r.downloaded)
        .map((r) => r.id);
    }

    if (ids.length === 0) {
      setMessage("No local files in the current selection");
      return;
    }

    const ok = await confirm({
      title: "Delete local files",
      message: `Delete local files for ${ids.length} ROM${ids.length === 1 ? "" : "s"}?`,
      hint: "RomM is not touched.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      tone: "danger",
    });
    if (!ok) return;

    setBusyKind("delete");
    setError(null);
    try {
      for (const id of ids) {
        await getApi().deleteLocal(id);
      }
      applyDeletedIds(ids);
      setMessage(
        `Removed local copies of ${ids.length} ROM${ids.length === 1 ? "" : "s"}`,
      );
      exitSelectMode();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyKind(null);
    }
  }, [
    selected,
    selectAll,
    filter,
    search,
    visible,
    downloadedIds,
    selectedIds,
    applyDeletedIds,
    exitSelectMode,
    confirm,
  ]);

  const downloadSelected = useCallback(async () => {
    if (!selected) return;

    if (selectAll) {
      if (filter === "downloaded") return;

      // No search: reuse platform enqueue (pages server-side, skips local copies).
      if (!search) {
        setBusyKind("download");
        setError(null);
        try {
          const result = await getApi().enqueuePlatform(
            selected.id,
            selected.slug,
          );
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
          setBusyKind(null);
        }
        return;
      }

      // With search: page the matching catalog, then enqueue.
      setBusyKind("download");
      setError(null);
      try {
        const query = catalogQueryFrom(selected, search);
        const items: { romId: number; platformSlug: string }[] = [];
        let offset = 0;
        let catalogTotal = Infinity;
        while (offset < catalogTotal) {
          const page = await fetchRomPage(query, { limit: 100, offset });
          catalogTotal = page.total;
          for (const rom of page.items) {
            if (rom.downloaded || downloadedIds.has(rom.id)) continue;
            if (activeDownloads.has(rom.id)) continue;
            items.push({
              romId: rom.id,
              platformSlug: rom.platform_slug ?? selected.slug,
            });
          }
          offset += page.items.length;
          if (page.items.length === 0) break;
        }
        if (items.length === 0) {
          setMessage("Nothing to download for the current selection");
          return;
        }
        await getApi().enqueueMany(items);
        setMessage(`Queued ${items.length} downloads`);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyKind(null);
      }
      return;
    }

    const items = visible
      .filter(
        (r) =>
          selectedIds.has(r.id) && !r.downloaded && !activeDownloads.has(r.id),
      )
      .map((r) => ({
        romId: r.id,
        platformSlug: r.platform_slug ?? selected.slug,
      }));
    if (items.length === 0) return;
    await getApi().enqueueMany(items);
    setMessage(`Queued ${items.length} downloads`);
  }, [
    selected,
    selectAll,
    filter,
    search,
    downloadedIds,
    visible,
    selectedIds,
    activeDownloads,
  ]);

  const downloadPlatform = useCallback(async () => {
    if (!selected) return;
    setBusyKind("platform");
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
      setBusyKind(null);
    }
  }, [selected]);

  return {
    platforms,
    visiblePlatforms,
    selected,
    searchInput,
    setSearchInput,
    selectedIds: displaySelectedIds,
    selectionState,
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
    busyKind,
    scrollRef,
    sentinelRef,
    selectPlatform,
    onSelectionButtonClick,
    exitSelectMode,
    onCardClick,
    closeDetail,
    downloadOne,
    deleteLocal,
    deleteSelected,
    downloadSelected,
    downloadPlatform,
    activeDownloads,
  };
}
