export const UI_THEMES = ["candy", "gold", "vector", "mint"] as const;

export type UiTheme = (typeof UI_THEMES)[number];

export const DEFAULT_UI_THEME: UiTheme = "candy";

export const DEFAULT_UI_SCANLINES = true;

export const DEFAULT_UI_SCANLINE_STRENGTH = 12;

/** Synced on apply so the next cold start can paint the right theme before config IPC. */
export const UI_THEME_STORAGE_KEY = "rommdeck.ui.theme";

export const UI_SCANLINES_STORAGE_KEY = "rommdeck.ui.scanlines";

export const UI_SCANLINE_STRENGTH_STORAGE_KEY = "rommdeck.ui.scanlineStrength";

export const UI_CRT_EVENT = "rommdeck:ui-crt";

export interface UiCrtSettings {
  scanlines: boolean;
  scanlineStrength: number;
}

export const UI_THEME_LABELS: Record<UiTheme, string> = {
  candy: "Candy",
  gold: "Gold",
  vector: "Vector",
  mint: "Mint",
};

/** Native window background — matches accent so frameless edge clip still looks like the frame. */
export const UI_THEME_ACCENTS: Record<UiTheme, string> = {
  candy: "#ff2d95",
  gold: "#e6b84d",
  vector: "#ff3b3b",
  mint: "#3dffc8",
};

/**
 * Frameless Chromium on Linux often paints ~1 device px less on bottom/right.
 * Snap the accent ring to whole device pixels and add that extra on BR so all
 * four sides read the same thickness.
 */
export function syncShellFrameMetrics(): void {
  const dpr = window.devicePixelRatio || 1;
  const targetCss = 3;
  const framePx = Math.max(2, Math.round(targetCss * dpr)) / dpr;
  const brPx = framePx + 1 / dpr;
  const root = document.documentElement;
  root.style.setProperty("--shell-frame", `${framePx}px`);
  root.style.setProperty("--shell-frame-br", `${brPx}px`);
}

export function isUiTheme(value: unknown): value is UiTheme {
  return (
    typeof value === "string" &&
    (UI_THEMES as readonly string[]).includes(value)
  );
}

export function clampScanlineStrength(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_UI_SCANLINE_STRENGTH;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function readStoredUiTheme(): UiTheme | null {
  try {
    const raw = localStorage.getItem(UI_THEME_STORAGE_KEY);
    return isUiTheme(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function readStoredUiScanlines(): boolean {
  try {
    const raw = localStorage.getItem(UI_SCANLINES_STORAGE_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
    return DEFAULT_UI_SCANLINES;
  } catch {
    return DEFAULT_UI_SCANLINES;
  }
}

export function readStoredScanlineStrength(): number {
  try {
    const raw = localStorage.getItem(UI_SCANLINE_STRENGTH_STORAGE_KEY);
    if (raw === null) return DEFAULT_UI_SCANLINE_STRENGTH;
    return clampScanlineStrength(Number(raw));
  } catch {
    return DEFAULT_UI_SCANLINE_STRENGTH;
  }
}

export function readStoredUiCrt(): UiCrtSettings {
  return {
    scanlines: readStoredUiScanlines(),
    scanlineStrength: readStoredScanlineStrength(),
  };
}

/** Apply theme on <html data-theme="…"> and cache for instant next launch. */
export function applyUiTheme(theme: UiTheme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(UI_THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore quota / private mode */
  }
  try {
    void window.rommdeck?.setWindowBackground(UI_THEME_ACCENTS[theme]);
  } catch {
    /* preload / non-Electron */
  }
}

/** Apply CRT overlay settings; notifies listeners via {@link UI_CRT_EVENT}. */
export function applyUiCrt(settings: UiCrtSettings): void {
  const scanlineStrength = clampScanlineStrength(settings.scanlineStrength);
  const scanlines = settings.scanlines;
  document.documentElement.dataset.scanlines = scanlines ? "on" : "off";
  document.documentElement.style.setProperty(
    "--crt-scanline-opacity",
    String(scanlineStrength / 100),
  );
  try {
    localStorage.setItem(UI_SCANLINES_STORAGE_KEY, scanlines ? "1" : "0");
    localStorage.setItem(
      UI_SCANLINE_STRENGTH_STORAGE_KEY,
      String(scanlineStrength),
    );
  } catch {
    /* ignore quota / private mode */
  }
  window.dispatchEvent(
    new CustomEvent<UiCrtSettings>(UI_CRT_EVENT, {
      detail: { scanlines, scanlineStrength },
    }),
  );
}
