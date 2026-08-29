import type { UiTheme } from "../../theme";
import type { LogLevel } from "./loggingLabels";

export interface SettingsConfig {
  romm: { baseUrl: string; apiToken: string };
  retrodeck: {
    configPath: string;
    romsPath: string;
    savesPath: string;
    statesPath: string;
    syncMetadataOnDownload: boolean;
  };
  sync: {
    enabled: boolean;
    mode: "push_pull" | "pull_only" | "push_only";
    intervalSeconds: number;
    debounceSeconds: number;
    conflictPolicy: "keep_both" | "server_wins" | "device_wins";
    deviceId: string | null;
    deviceName: string;
    registerNewDevice?: boolean;
    resetSyncHistory?: boolean;
  };
  ui: { theme: UiTheme; scanlines: boolean; scanlineStrength: number };
  logging: { level: LogLevel };
  platformMapOverrides: Record<string, string>;
}

export interface PathsInfo {
  configPath: string;
  romsPath: string;
  savesPath: string;
  statesPath: string;
  source: string;
}
