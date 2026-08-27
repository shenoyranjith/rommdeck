export const UI_THEMES = ["candy", "gold", "vector", "mint"] as const;

export type UiTheme = (typeof UI_THEMES)[number];

export const DEFAULT_UI_THEME: UiTheme = "candy";

/** Synced on apply so the next cold start can paint the right theme before config IPC. */
export const UI_THEME_STORAGE_KEY = "rommdeck.ui.theme";

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

export function readStoredUiTheme(): UiTheme | null {
  try {
    const raw = localStorage.getItem(UI_THEME_STORAGE_KEY);
    return isUiTheme(raw) ? raw : null;
  } catch {
    return null;
  }
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
