import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { gamelistWriteQueue } from "./gamelist-queue.js";

export interface GamelistGame {
  path: string;
  name?: string;
  desc?: string;
  releasedate?: string;
  developer?: string;
  publisher?: string;
  genre?: string;
  players?: string;
}

/** Relative gamelist path for a ROM filename (ES-DE requires `./` prefix). */
export function gamelistPathForRom(filename: string): string {
  const trimmed = filename.replace(/^\.\//, "");
  return `./${trimmed}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function readTag(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const match = block.match(re);
  return match ? unescapeXml(match[1].trim()) : undefined;
}

function writeTag(tag: string, value: string | undefined): string {
  if (!value) return "";
  return `    <${tag}>${escapeXml(value)}</${tag}>\n`;
}

export function parseGamelistXml(content: string): GamelistGame[] {
  const games: GamelistGame[] = [];
  const gameRe = /<game>([\s\S]*?)<\/game>/g;
  let match: RegExpExecArray | null;
  while ((match = gameRe.exec(content)) !== null) {
    const block = match[1];
    const path = readTag(block, "path");
    if (!path) continue;
    games.push({
      path,
      name: readTag(block, "name"),
      desc: readTag(block, "desc"),
      releasedate: readTag(block, "releasedate"),
      developer: readTag(block, "developer"),
      publisher: readTag(block, "publisher"),
      genre: readTag(block, "genre"),
      players: readTag(block, "players"),
    });
  }
  return games;
}

function serializeGame(game: GamelistGame): string {
  let xml = "  <game>\n";
  xml += writeTag("path", game.path);
  xml += writeTag("name", game.name);
  xml += writeTag("desc", game.desc);
  xml += writeTag("releasedate", game.releasedate);
  xml += writeTag("developer", game.developer);
  xml += writeTag("publisher", game.publisher);
  xml += writeTag("genre", game.genre);
  xml += writeTag("players", game.players);
  xml += "  </game>\n";
  return xml;
}

export function serializeGamelistXml(games: GamelistGame[]): string {
  const sorted = [...games].sort((a, b) => a.path.localeCompare(b.path));
  let xml = '<?xml version="1.0"?>\n<gameList>\n';
  for (const game of sorted) xml += serializeGame(game);
  xml += "</gameList>\n";
  return xml;
}

function normalizeGamelistPath(path: string): string {
  return gamelistPathForRom(path.replace(/^\.\//, ""));
}

export function readGamelist(filePath: string): GamelistGame[] {
  if (!existsSync(filePath)) return [];
  try {
    return parseGamelistXml(readFileSync(filePath, "utf8"));
  } catch {
    return [];
  }
}

export function writeGamelist(filePath: string, games: GamelistGame[]): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, serializeGamelistXml(games), "utf8");
}

/** True when gamelist.xml contains an entry for this ROM filename. */
export function hasGamelistEntry(filePath: string, romFilename: string): boolean {
  const target = normalizeGamelistPath(gamelistPathForRom(romFilename));
  return readGamelist(filePath).some((g) => normalizeGamelistPath(g.path) === target);
}

/** Insert or replace a game entry matched by relative ROM path (caller must hold gamelist lock). */
export function upsertGamelistGame(filePath: string, game: GamelistGame): void {
  const target = normalizeGamelistPath(game.path);
  const games = readGamelist(filePath).filter((g) => normalizeGamelistPath(g.path) !== target);
  games.push({ ...game, path: target });
  writeGamelist(filePath, games);
}

/** Remove a game entry by relative ROM path (caller must hold gamelist lock). */
export function removeGamelistGame(filePath: string, romPath: string): boolean {
  const target = normalizeGamelistPath(romPath);
  const games = readGamelist(filePath);
  const next = games.filter((g) => normalizeGamelistPath(g.path) !== target);
  if (next.length === games.length) return false;
  if (next.length === 0 && existsSync(filePath)) {
    writeFileSync(filePath, '<?xml version="1.0"?>\n<gameList>\n</gameList>\n', "utf8");
  } else {
    writeGamelist(filePath, next);
  }
  return true;
}

/** Locked upsert — safe across concurrent metadata jobs for the same platform. */
export function upsertGamelistGameLocked(
  filePath: string,
  game: GamelistGame,
  signal?: AbortSignal,
): Promise<void> {
  return gamelistWriteQueue.run(filePath, () => upsertGamelistGame(filePath, game), signal);
}

/** Locked remove — safe across concurrent metadata jobs for the same platform. */
export function removeGamelistGameLocked(
  filePath: string,
  romPath: string,
  signal?: AbortSignal,
): Promise<boolean> {
  return gamelistWriteQueue.run(filePath, () => removeGamelistGame(filePath, romPath), signal);
}
