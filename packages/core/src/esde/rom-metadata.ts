import type { RommMetadatum, RommRom } from "../romm/types.js";
import type { GamelistGame } from "./gamelist.js";
import { gamelistPathForRom } from "./gamelist.js";

function pickMetadatum(rom: RommRom): RommMetadatum | undefined {
  return (
    rom.metadatum ??
    rom.igdb_metadata ??
    rom.ss_metadata ??
    rom.moby_metadata ??
    rom.launchbox_metadata ??
    undefined
  );
}

function releaseTimestamp(meta: RommMetadatum | undefined, rom: RommRom): number | undefined {
  const raw =
    meta?.first_release_date ??
    rom.igdb_metadata?.first_release_date ??
    rom.generated_first_release_date;
  if (raw == null || raw === 0) return undefined;
  return raw;
}

/** Format RomM epoch (seconds or milliseconds) for ES-DE gamelist.xml. */
export function formatEsdeReleaseDate(ts: number): string {
  const ms = ts > 1e12 ? ts : ts * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${mo}${day}T000000`;
}

function primaryDeveloper(meta: RommMetadatum | undefined): string | undefined {
  return meta?.developers?.[0] ?? meta?.companies?.[0];
}

function primaryPublisher(meta: RommMetadatum | undefined): string | undefined {
  return meta?.publishers?.[0] ?? meta?.companies?.[1];
}

function genreLabel(meta: RommMetadatum | undefined): string | undefined {
  const genres = meta?.genres?.filter(Boolean);
  return genres?.length ? genres.join(" / ") : undefined;
}

function playersLabel(meta: RommMetadatum | undefined, rom: RommRom): string | undefined {
  if (rom.generated_player_count) return rom.generated_player_count;
  const modes = meta?.game_modes?.filter(Boolean);
  return modes?.length ? modes.join(" / ") : undefined;
}

export function buildGamelistEntry(rom: RommRom, primaryFilename: string): GamelistGame {
  const meta = pickMetadatum(rom);
  const releaseTs = releaseTimestamp(meta, rom);
  const entry: GamelistGame = {
    path: gamelistPathForRom(primaryFilename),
    name: rom.name?.trim() || undefined,
    desc: rom.summary?.trim() || undefined,
    developer: primaryDeveloper(meta),
    publisher: primaryPublisher(meta),
    genre: genreLabel(meta),
    players: playersLabel(meta, rom),
  };
  if (releaseTs != null) entry.releasedate = formatEsdeReleaseDate(releaseTs);
  return entry;
}
