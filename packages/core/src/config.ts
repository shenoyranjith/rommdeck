import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { getConfigDir, getConfigPath } from "./paths.js";

export type ConflictPolicy = "keep_both" | "server_wins" | "device_wins";
export type SyncMode = "push_pull" | "pull_only" | "push_only";
export type ProfileName = "dev" | "prod";

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

export interface RommDeckConfig {
  profile: ProfileName;
  romm: RommConfig;
  retrodeck: RetroDeckConfig;
  sync: SyncConfig;
  /** RomM slug → ES-DE folder overrides */
  platformMapOverrides: Record<string, string>;
}

export const DEFAULT_CONFIG: RommDeckConfig = {
  profile: "prod",
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
  platformMapOverrides: {},
};

export const DEV_DEFAULTS: Partial<RommDeckConfig> = {
  profile: "dev",
  sync: {
    enabled: false,
    mode: "push_pull",
    intervalSeconds: 60,
    debounceSeconds: 15,
    conflictPolicy: "keep_both",
    deviceId: null,
    deviceName: "RommDeck Dev",
  },
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

export function resolveProfile(): ProfileName {
  const env = process.env.ROMMDECK_PROFILE;
  if (env === "dev" || env === "prod") return env;
  return "prod";
}

export function loadConfig(): RommDeckConfig {
  const profile = resolveProfile();
  let cfg: RommDeckConfig = {
    ...DEFAULT_CONFIG,
    ...(profile === "dev" ? deepMerge(DEFAULT_CONFIG, DEV_DEFAULTS as Partial<RommDeckConfig>) : {}),
    profile,
  };

  const path = getConfigPath();
  if (existsSync(path)) {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<RommDeckConfig>;
    cfg = deepMerge(cfg, raw);
  }

  // Profile-specific sidecar: config.dev.json next to config.json
  const profilePath = `${dirname(path)}/config.${profile}.json`;
  if (existsSync(profilePath)) {
    const raw = JSON.parse(readFileSync(profilePath, "utf8")) as Partial<RommDeckConfig>;
    cfg = deepMerge(cfg, raw);
  }

  cfg.profile = profile;
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
