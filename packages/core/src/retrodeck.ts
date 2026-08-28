import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getDefaultRetroDeckJsonPath } from "./paths.js";
import type { RetroDeckConfig } from "./config.js";

export interface RetroDeckPaths {
  configPath: string;
  rdHomePath: string;
  romsPath: string;
  savesPath: string;
  statesPath: string;
  downloadedMediaPath: string;
  source: "auto" | "override" | "fixture";
}

interface RetroDeckJson {
  paths?: {
    rd_home_path?: string;
    roms_path?: string;
    saves_path?: string;
    states_path?: string;
    downloaded_media_path?: string;
  };
}

export function readRetroDeckJson(configPath: string): RetroDeckJson | null {
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as RetroDeckJson;
  } catch {
    return null;
  }
}

export function resolveRetroDeckPaths(cfg: RetroDeckConfig): RetroDeckPaths {
  const candidates: string[] = [];
  if (cfg.configPath) candidates.push(cfg.configPath);
  candidates.push(getDefaultRetroDeckJsonPath());

  let detected: RetroDeckJson | null = null;
  let usedPath = "";
  for (const p of candidates) {
    const json = readRetroDeckJson(p);
    if (json?.paths) {
      detected = json;
      usedPath = p;
      break;
    }
  }

  const paths = detected?.paths ?? {};
  const romsPath = cfg.romsPath || paths.roms_path || "";
  const savesPath = cfg.savesPath || paths.saves_path || "";
  const statesPath = cfg.statesPath || paths.states_path || "";
  const rdHomePath = paths.rd_home_path || "";
  const downloadedMediaPath =
    paths.downloaded_media_path ||
    (rdHomePath ? join(rdHomePath, "ES-DE", "downloaded_media") : "");

  const hasOverride = Boolean(cfg.romsPath || cfg.savesPath || cfg.statesPath);
  const isFixture = usedPath.includes("fixtures") || usedPath.includes("rommdeck-dev");

  return {
    configPath: usedPath || cfg.configPath || getDefaultRetroDeckJsonPath(),
    rdHomePath,
    romsPath,
    savesPath,
    statesPath,
    downloadedMediaPath,
    source: hasOverride ? "override" : isFixture ? "fixture" : "auto",
  };
}
