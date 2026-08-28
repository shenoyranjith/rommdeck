import { useEffect, useMemo, useState } from "react";
import { getApi } from "../../api";
import { cn } from "../../lib/cn";
import { btnClass, btnPrimaryClass, inputClass } from "../../components/ui";
import {
  buildPlatformMapRows,
  overridesFromRows,
  rowSource,
  PLATFORM_MAP_SOURCE_LABEL,
  type PlatformMapRow,
} from "./platformMapRows";

export function PlatformMapEditor({
  overrides,
  onSave,
  onCancel,
}: {
  overrides: Record<string, string>;
  onSave: (overrides: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [bundled, setBundled] = useState<Record<string, string> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<PlatformMapRow[]>([]);
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const map = await getApi().getBundledPlatformMap();
        setBundled(map);
        setRows(buildPlatformMapRows(map, overrides));
        setLoadError(null);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [overrides]);

  const visibleRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.rommSlug.toLowerCase().includes(q) ||
        row.esdeFolder.toLowerCase().includes(q),
    );
  }, [rows, filter]);

  const updateRow = (rommSlug: string, esdeFolder: string) => {
    if (!bundled) return;
    setRows((prev) =>
      prev.map((row) =>
        row.rommSlug === rommSlug
          ? {
              rommSlug,
              esdeFolder,
              source: rowSource(rommSlug, esdeFolder, bundled),
            }
          : row,
      ),
    );
  };

  const handleSave = async () => {
    if (!bundled) return;
    setSaving(true);
    try {
      await onSave(overridesFromRows(rows, bundled));
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="p-4">
        <p className="text-sm text-danger">{loadError}</p>
        <button type="button" className={`${btnClass} mt-3`} onClick={onCancel}>
          Back
        </button>
      </div>
    );
  }

  if (!bundled) {
    return (
      <div className="p-4 text-sm text-muted">Loading platform map…</div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm text-muted">
          RomM platform slug → ES-DE folder. Edit folders that differ from the
          bundled default; unchanged rows are not saved as overrides.
        </p>
        <input
          className={`${inputClass} mt-3`}
          placeholder="Filter by slug or folder…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-bg0">
            <tr className="border-b border-line text-left text-[11px] tracking-wide text-muted uppercase">
              <th className="px-4 py-2.5 font-medium">RomM slug</th>
              <th className="px-4 py-2.5 font-medium">ES-DE folder</th>
              <th className="px-4 py-2.5 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-sm text-muted"
                >
                  No mappings match your filter.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr
                  key={row.rommSlug}
                  className="border-b border-line/70 last:border-b-0"
                >
                  <td className="px-4 py-2 font-mono text-accent">
                    {row.rommSlug}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className={`${inputClass} font-mono text-xs`}
                      value={row.esdeFolder}
                      onChange={(e) =>
                        updateRow(row.rommSlug, e.target.value)
                      }
                      spellCheck={false}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={cn(
                        "inline-block border px-2 py-0.5 font-mono text-[11px] uppercase",
                        row.source === "override" &&
                          "border-accent/50 text-accent",
                        row.source === "default" && "border-line text-muted",
                        row.source === "identity" && "border-line text-muted",
                      )}
                    >
                      {PLATFORM_MAP_SOURCE_LABEL[row.source]}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        <button
          type="button"
          className={btnPrimaryClass}
          style={{ boxShadow: "var(--glow)" }}
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className={btnClass}
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
