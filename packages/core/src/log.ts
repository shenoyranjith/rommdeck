import { appendFileSync, mkdirSync } from "node:fs";
import { getAppLogPath, getLogsDir } from "./paths.js";

type LogData = Record<string, unknown>;
type LogLevel = "INFO" | "WARN" | "ERROR";

let initialized = false;

function ensureLogFile(): string {
  if (!initialized) {
    mkdirSync(getLogsDir(), { recursive: true });
    initialized = true;
  }
  return getAppLogPath();
}

function write(level: LogLevel, scope: string, msg: string, data?: LogData): void {
  const ts = new Date().toISOString();
  const payload = data ? ` ${JSON.stringify(data)}` : "";
  const line = `${ts} ${level} [${scope}] ${msg}${payload}\n`;
  try {
    appendFileSync(ensureLogFile(), line, "utf8");
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
