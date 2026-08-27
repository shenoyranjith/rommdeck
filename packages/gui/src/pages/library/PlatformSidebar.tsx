import { cn } from "../../lib/cn";
import type { Platform } from "./types";

export function PlatformSidebar({
  platforms,
  visiblePlatforms,
  selected,
  showAllPlatforms,
  onShowAllPlatforms,
  onSelectPlatform,
}: {
  platforms: Platform[];
  visiblePlatforms: Platform[];
  selected: Platform | null;
  showAllPlatforms: boolean;
  onShowAllPlatforms: (showAll: boolean) => void;
  onSelectPlatform: (platform: Platform) => void;
}) {
  return (
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
            onClick={() => onShowAllPlatforms(false)}
          >
            With ROMs
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 rounded px-2 py-1 font-medium transition-colors",
              showAllPlatforms ? "bg-accent text-accent-fg" : "text-muted hover:text-text",
            )}
            onClick={() => onShowAllPlatforms(true)}
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
                selected?.id === p.id ? "bg-accent text-accent-fg" : "text-text hover:bg-bg2",
              )}
              onClick={() => onSelectPlatform(p)}
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
  );
}
