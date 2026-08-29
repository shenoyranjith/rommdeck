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
