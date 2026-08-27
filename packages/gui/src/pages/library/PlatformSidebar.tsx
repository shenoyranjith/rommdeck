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
    <aside className="flex min-h-0 flex-col overflow-hidden border border-accent bg-bg0/60">
      <div className="border-b border-accent/50 px-3 py-2.5">
        <div className="text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">
          Platforms
        </div>
        <div className="mt-2 flex border border-accent/50 p-0.5 text-[11px]">
          <button
            type="button"
            className={cn(
              "flex-1 px-2 py-1 font-medium transition-colors",
              !showAllPlatforms
                ? "bg-accent text-accent-fg"
                : "text-muted hover:text-text",
            )}
            onClick={() => onShowAllPlatforms(false)}
          >
            With ROMs
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 px-2 py-1 font-medium transition-colors",
              showAllPlatforms
                ? "bg-accent text-accent-fg"
                : "text-muted hover:text-text",
            )}
            onClick={() => onShowAllPlatforms(true)}
          >
            All
          </button>
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-auto p-1.5">
        {visiblePlatforms.map((p) => {
          const active = selected?.id === p.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 border px-2.5 py-2 text-left text-sm transition-colors",
                  active
                    ? "border-accent bg-transparent text-text"
                    : "border-transparent text-text hover:border-line hover:bg-bg2/50",
                )}
                onClick={() => onSelectPlatform(p)}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center overflow-hidden border",
                    active ? "border-accent/60 bg-bg0" : "border-line bg-bg0",
                  )}
                >
                  {p.logoUrl ? (
                    <img
                      src={p.logoUrl}
                      alt=""
                      className="size-full object-contain p-0.5"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-[9px] font-bold tracking-wide text-muted">
                      {(p.displayName || p.name).slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {p.displayName || p.name}
                </span>
                <span className="shrink-0 font-mono text-xs text-accent">
                  {p.rom_count ?? "—"}
                </span>
              </button>
            </li>
          );
        })}
        {platforms.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted">
            No platforms. Check Settings.
          </li>
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
