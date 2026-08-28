import type { CSSProperties } from "react";
import { BrandMark } from "../../components/BrandMark";
import { IconCheck } from "../../components/icons";
import { Panel } from "../../components/ui";
import { cn } from "../../lib/cn";
import {
  UI_THEMES,
  UI_THEME_ACCENTS,
  UI_THEME_LABELS,
  type UiTheme,
} from "../../theme";

const THEME_BG: Record<UiTheme, string> = {
  candy: "#0c0c12",
  gold: "#100e0a",
  vector: "#0c0c0c",
  mint: "#0a1014",
};

export function AppearanceSection({
  theme,
  onThemeChange,
}: {
  theme: UiTheme;
  onThemeChange: (theme: UiTheme) => void;
}) {
  return (
    <Panel>
        <div className="p-4">
          <p className="mb-4 text-sm text-muted">
            Color scheme only — shell layout stays the same. Saved automatically.
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {UI_THEMES.map((t) => {
              const active = theme === t;
              const accent = UI_THEME_ACCENTS[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onThemeChange(t)}
                  className={cn(
                    "group relative overflow-hidden border text-left transition-colors",
                    active
                      ? "border-accent shadow-[var(--glow)]"
                      : "border-line hover:border-accent/60",
                  )}
                >
                  <div
                    className="relative flex aspect-[4/3] items-center justify-center"
                    style={{
                      background: `linear-gradient(160deg, ${THEME_BG[t]} 0%, color-mix(in srgb, ${accent} 22%, ${THEME_BG[t]}) 100%)`,
                    }}
                  >
                    <div
                      className="pointer-events-none scale-[0.55]"
                      style={
                        {
                          "--accent": accent,
                        } as CSSProperties
                      }
                    >
                      <BrandMark size={96} />
                    </div>
                    {active && (
                      <span className="absolute top-2 right-2 flex size-6 items-center justify-center border border-accent bg-bg0/90 text-accent">
                        <IconCheck className="size-4" strokeWidth={2.5} />
                      </span>
                    )}
                  </div>
                  <div
                    className={cn(
                      "border-t px-3 py-2",
                      active
                        ? "border-accent/50 bg-accent/10"
                        : "border-line bg-bg0/80",
                    )}
                  >
                    <div className="font-semibold text-text">
                      {UI_THEME_LABELS[t]}
                    </div>
                    <div className="font-mono text-[11px] text-muted">{t}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Panel>
  );
}
