import type { CSSProperties } from "react";
import { BrandMark } from "../../components/BrandMark";
import { Switch } from "../../components/Switch";
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
  scanlines,
  scanlineStrength,
  onThemeChange,
  onScanlinesChange,
  onScanlineStrengthChange,
}: {
  theme: UiTheme;
  scanlines: boolean;
  scanlineStrength: number;
  onThemeChange: (theme: UiTheme) => void;
  onScanlinesChange: (enabled: boolean) => void;
  onScanlineStrengthChange: (strength: number) => void;
}) {
  return (
    <Panel>
      <div className="p-4">
        <p className="mb-4 text-sm text-muted">
          Color scheme and shell effects. Saved automatically.
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

        <div className="mt-6 space-y-3 border border-line bg-bg0/50 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">CRT scanlines</p>
              <p className="mt-0.5 text-xs text-muted">
                Horizontal overlay on the app shell
              </p>
            </div>
            <div className="flex shrink-0 items-center self-center py-0.5">
              <Switch
                id="ui-scanlines"
                checked={scanlines}
                onCheckedChange={onScanlinesChange}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">
                Overlay strength
              </p>
            </div>
            <div className="flex shrink-0 items-center self-center py-0.5">
              <div
                className={cn(
                  "relative h-6 w-11",
                  !scanlines && "opacity-40",
                )}
              >
                <input
                  className="h-full w-full border border-line bg-bg0 py-0 pr-3.5 pl-1 text-right text-xs text-text outline-none focus:border-accent disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  disabled={!scanlines}
                  value={scanlineStrength}
                  onChange={(e) =>
                    onScanlineStrengthChange(Number(e.target.value) || 0)
                  }
                />
                <span className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-[10px] text-muted">
                  %
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
