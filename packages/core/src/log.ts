import {
  appendFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { getAppLogPath, getLogsDir } from "./paths.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export const LOG_LEVELS: readonly LogLevel[] = [
  "debug",
  "info",
  "warn",
  "error",
] as const;

export const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
  debug: "Debug — verbose (IPC args, sync ops, API)",
  info: "Info — normal operation",
  warn: "Warn — recoverable issues",
  error: "Error — failures only",
};

type LogData = Record<string, unknown>;
type LogScope =
  | "app"
  | "ipc"
  | "download"
  | "library"
  | "esde"
  | "index"
  | "sync"
  | "daemon"
  | "config"
  | "romm";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MAX_LOG_BYTES = 5 * 1024 * 1024;
/** Archived files: rommdeck.log.1 … rommdeck.log.{MAX_ARCHIVED_LOGS} */
const MAX_ARCHIVED_LOGS = 9;

let initialized = false;
let minLevel: LogLevel = "info";

export function configureLogging(level: LogLevel): void {
  minLevel = LOG_LEVELS.includes(level) ? level : "info";
}

export function getConfiguredLogLevel(): LogLevel {
  return minLevel;
}

function ensureLogsDir(): void {
  if (!initialized) {
    mkdirSync(getLogsDir(), { recursive: true });
    initialized = true;
  }
}

function archivedLogPath(index: number): string {
  return join(getLogsDir(), `rommdeck.log.${index}`);
}

function rotateLogsIfNeeded(activePath: string, incomingBytes: number): void {
  if (!existsSync(activePath)) return;

  const size = statSync(activePath).size;
  if (size + incomingBytes <= MAX_LOG_BYTES) return;

  const oldest = archivedLogPath(MAX_ARCHIVED_LOGS);
  if (existsSync(oldest)) unlinkSync(oldest);

  for (let i = MAX_ARCHIVED_LOGS - 1; i >= 1; i--) {
    const from = archivedLogPath(i);
    if (!existsSync(from)) continue;
    renameSync(from, archivedLogPath(i + 1));
  }

  renameSync(activePath, archivedLogPath(1));
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel];
}

function write(
  level: LogLevel,
  scope: LogScope | string,
  msg: string,
  data?: LogData,
): void {
  if (!shouldLog(level)) return;

  const ts = new Date().toISOString();
  const levelTag = level.toUpperCase();
  const payload = data ? ` ${JSON.stringify(data)}` : "";
  const line = `${ts} ${levelTag} [${scope}] ${msg}${payload}\n`;
  const bytes = Buffer.byteLength(line, "utf8");

  if (level === "error" || level === "warn") {
    const consoleFn = level === "error" ? console.error : console.warn;
    consoleFn(line.trimEnd());
  } else if (shouldLog("debug") && level === "debug") {
    console.debug(line.trimEnd());
  }

  try {
    ensureLogsDir();
    const activePath = getAppLogPath();
    rotateLogsIfNeeded(activePath, bytes);
    appendFileSync(activePath, line, "utf8");
  } catch {
    /* never crash the app for logging failures */
  }
}

/** Structured logging for RommDeck backend (Electron main, syncd, core). */
export const log = {
  debug: (scope: LogScope | string, msg: string, data?: LogData) =>
    write("debug", scope, msg, data),
  info: (scope: LogScope | string, msg: string, data?: LogData) =>
    write("info", scope, msg, data),
  warn: (scope: LogScope | string, msg: string, data?: LogData) =>
    write("warn", scope, msg, data),
  error: (scope: LogScope | string, msg: string, data?: LogData) =>
    write("error", scope, msg, data),
  app: (msg: string, data?: LogData) => write("info", "app", msg, data),
  download: (msg: string, data?: LogData) => write("info", "download", msg, data),
  library: (msg: string, data?: LogData) => write("info", "library", msg, data),
  esde: (msg: string, data?: LogData) => write("info", "esde", msg, data),
  index: (msg: string, data?: LogData) => write("info", "index", msg, data),
  sync: (msg: string, data?: LogData) => write("info", "sync", msg, data),
  daemon: (msg: string, data?: LogData) => write("info", "daemon", msg, data),
  config: (msg: string, data?: LogData) => write("info", "config", msg, data),
};

export { getAppLogPath } from "./paths.js";
