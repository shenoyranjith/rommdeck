import type { RomItem } from "./types";

export function romStatusLabel(rom: RomItem): string {
  if (!rom.downloaded) return "Missing";
  if (rom.verified === false) return "Unverified";
  return "Downloaded";
}

export function romStatusClass(rom: RomItem): string {
  if (!rom.downloaded) return "border-warn/60 text-warn";
  if (rom.verified === false) return "border-warn/50 text-warn";
  return "border-accent/70 text-accent";
}

export function romDetailStatusClass(rom: RomItem): string {
  if (!rom.downloaded) return "border border-warn/50 text-warn";
  if (rom.verified === false) return "border border-warn/50 text-warn bg-warn/10";
  return "bg-ok/15 text-ok";
}
