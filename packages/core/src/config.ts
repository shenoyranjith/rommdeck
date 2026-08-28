import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { getConfigDir, getConfigPath } from "./paths.js";

export type ConflictPolicy = "keep_both" | "server_wins" | "device_wins";
export type SyncMode = "push_pull" | "pull_only" | "push_only";
export type UiTheme = "candy" | "gold" | "vector" | "mint";

export const UI_THEMES: readonly UiTheme[] = ["candy", "gold", "vector", "mint"] as const;

export interface RommConfig {
  baseUrl: string;
  apiToken: string;
}

export interface RetroDeckConfig {
  /** Path to retrodeck.json; empty = auto-detect */
  configPath: string;
  /** Manual overrides; empty string means use detected value */
  romsPath: string;
  savesPath: string;
  statesPath: string;
}

export interface SyncConfig {
  enabled: boolean;
  mode: SyncMode;
  intervalSeconds: number;
  debounceSeconds: number;
  conflictPolicy: ConflictPolicy;
  deviceId: number | null;
  deviceName: string;
}

export interface UiConfig {
  theme: UiTheme;
  /** CRT scanline overlay on the app shell */
  scanlines: boolean;
  /** Overlay opacity as 0–100 (maps to CSS opacity) */
  scanlineStrength: number;
}

export interface RommDeckConfig {
  romm: RommConfig;
  retrodeck: RetroDeckConfig;
  sync: SyncConfig;
  ui: UiConfig;
  /** RomM slug → ES-DE folder overrides */
  platformMapOverrides: Record<string, string>;
}

export const DEFAULT_CONFIG: RommDeckConfig = {
  romm: {
    baseUrl: "",
    apiToken: "",
  },
  retrodeck: {
    configPath: "",
    romsPath: "",
    savesPath: "",
    statesPath: "",
  },
  sync: {
    enabled: false,
    mode: "push_pull",
    intervalSeconds: 300,
    debounceSeconds: 45,
    conflictPolicy: "keep_both",
    deviceId: null,
    deviceName: "RommDeck",
  },
  ui: {
    theme: "candy",
    scanlines: true,
    scanlineStrength: 12,
  },
  platformMapOverrides: {},
};

function deepMerge<T>(base: T, over: Partial<T>): T {
  if (over === null || over === undefined) return base;
  if (typeof base !== "object" || base === null || Array.isArray(base)) {
    return (over as T) ?? base;
  }
  const out = { ...(base as object) } as T;
  for (const key of Object.keys(over) as (keyof T)[]) {
    const v = over[key];
    const b = (base as T)[key];
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      b &&
      typeof b === "object" &&
      !Array.isArray(b)
    ) {
      out[key] = deepMerge(b, v as Partial<typeof b>);
    } else if (v !== undefined) {
      out[key] = v as T[keyof T];
    }
  }
  return out;
}

export function loadConfig(): RommDeckConfig {
  let cfg: RommDeckConfig = deepMerge(DEFAULT_CONFIG, {});

  const path = getConfigPath();
  if (existsSync(path)) {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<RommDeckConfig>;
    cfg = deepMerge(DEFAULT_CONFIG, raw);
  }

  // Normalize unknown / missing theme from older configs
  if (!UI_THEMES.includes(cfg.ui?.theme)) {
    cfg = { ...cfg, ui: { ...cfg.ui, theme: DEFAULT_CONFIG.ui.theme } };
  }
  if (typeof cfg.ui?.scanlines !== "boolean") {
    cfg = { ...cfg, ui: { ...cfg.ui, scanlines: DEFAULT_CONFIG.ui.scanlines } };
  }
  const strength = cfg.ui?.scanlineStrength;
  if (typeof strength !== "number" || !Number.isFinite(strength)) {
    cfg = {
      ...cfg,
      ui: { ...cfg.ui, scanlineStrength: DEFAULT_CONFIG.ui.scanlineStrength },
    };
  } else {
    cfg = {
      ...cfg,
      ui: {
        ...cfg.ui,
        scanlineStrength: Math.min(100, Math.max(0, Math.round(strength))),
      },
    };
  }

  return cfg;
}

export function saveConfig(config: RommDeckConfig): void {
  const dir = getConfigDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), "utf8");
}

export function updateConfig(partial: Partial<RommDeckConfig>): RommDeckConfig {
  const current = loadConfig();
  const next = deepMerge(current, partial);
  saveConfig(next);
  return next;
}
