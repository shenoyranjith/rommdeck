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

type LogData = Record<string, unknown>;
type LogLevel = "INFO" | "WARN" | "ERROR";

const MAX_LOG_BYTES = 5 * 1024 * 1024;
/** Archived files: rommdeck.log.1 … rommdeck.log.{MAX_ARCHIVED_LOGS} */
const MAX_ARCHIVED_LOGS = 9;

let initialized = false;

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

function write(level: LogLevel, scope: string, msg: string, data?: LogData): void {
  const ts = new Date().toISOString();
  const payload = data ? ` ${JSON.stringify(data)}` : "";
  const line = `${ts} ${level} [${scope}] ${msg}${payload}\n`;
  const bytes = Buffer.byteLength(line, "utf8");

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
  app: (msg: string, data?: LogData) => write("INFO", "app", msg, data),
  download: (msg: string, data?: LogData) => write("INFO", "download", msg, data),
  library: (msg: string, data?: LogData) => write("INFO", "library", msg, data),
  esde: (msg: string, data?: LogData) => write("INFO", "esde", msg, data),
  index: (msg: string, data?: LogData) => write("INFO", "index", msg, data),
  warn: (scope: string, msg: string, data?: LogData) => write("WARN", scope, msg, data),
  error: (scope: string, msg: string, data?: LogData) => write("ERROR", scope, msg, data),
};

export { getAppLogPath } from "./paths.js";
