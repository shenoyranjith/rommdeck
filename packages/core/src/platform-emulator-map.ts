import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** Emulator family for an ES-DE folder (RetroDECK factory defaults). */
export type PlatformEmulatorFamily = "retroarch" | "standalone" | string;

let cachedMap: Record<string, PlatformEmulatorFamily> | null = null;

function bundledMapPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "../../../data/platform-emulator-map.json"),
    join(here, "../../data/platform-emulator-map.json"),
    join(process.cwd(), "data/platform-emulator-map.json"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0]!;
}

export function loadPlatformEmulatorMap(): Record<string, PlatformEmulatorFamily> {
  if (cachedMap) return cachedMap;
  const path = bundledMapPath();
  if (!existsSync(path)) {
    cachedMap = {};
    return cachedMap;
  }
  cachedMap = JSON.parse(readFileSync(path, "utf8")) as Record<string, PlatformEmulatorFamily>;
  return cachedMap;
}

/** Whether save sync should probe RetroArch paths for this ES-DE folder (v1). */
export function isRetroArchSyncPlatform(esdeFolder: string): boolean {
  const family = loadPlatformEmulatorMap()[esdeFolder];
  if (!family) return true;
  return family === "retroarch";
}

/** Clear cached map (tests). */
export function resetPlatformEmulatorMapCache(): void {
  cachedMap = null;
}
