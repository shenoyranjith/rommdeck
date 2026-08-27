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

export function isUiTheme(value: unknown): value is UiTheme {
  return typeof value === "string" && (UI_THEMES as readonly string[]).includes(value);
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
}
