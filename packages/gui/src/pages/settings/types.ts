import type { UiTheme } from "../../theme";

export interface SettingsConfig {
  romm: { baseUrl: string; apiToken: string };
  retrodeck: {
    configPath: string;
    romsPath: string;
    savesPath: string;
    statesPath: string;
  };
  sync: {
    enabled: boolean;
    mode: "push_pull" | "pull_only" | "push_only";
    intervalSeconds: number;
    debounceSeconds: number;
    conflictPolicy: "keep_both" | "server_wins" | "device_wins";
    deviceId: number | null;
    deviceName: string;
  };
  ui: { theme: UiTheme; scanlines: boolean; scanlineStrength: number };
  platformMapOverrides: Record<string, string>;
}

export interface PathsInfo {
  configPath: string;
  romsPath: string;
  savesPath: string;
  statesPath: string;
  source: string;
}
