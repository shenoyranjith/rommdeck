import { homedir } from "node:os";
import { join } from "node:path";

export function getConfigDir(): string {
  return process.env.ROMMDECK_CONFIG_DIR ?? join(homedir(), ".config", "rommdeck");
}

export function getDataDir(): string {
  return process.env.ROMMDECK_DATA_DIR ?? join(homedir(), ".local", "share", "rommdeck");
}

export function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

export function getLibraryDbPath(): string {
  return join(getDataDir(), "library.db");
}

export function getDaemonStatusPath(): string {
  return join(getDataDir(), "daemon-status.json");
}

export function getLogsDir(): string {
  return join(getDataDir(), "logs");
}

export function getAppLogPath(): string {
  return join(getLogsDir(), "rommdeck.log");
}

export function getDownloadQueuePath(): string {
  return join(getDataDir(), "download-queue.json");
}

export function getDefaultRetroDeckJsonPath(): string {
  return join(
    homedir(),
    ".var",
    "app",
    "net.retrodeck.retrodeck",
    "config",
    "retrodeck",
    "retrodeck.json",
  );
}
