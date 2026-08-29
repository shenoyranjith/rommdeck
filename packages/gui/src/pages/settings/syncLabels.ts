import type { SettingsConfig } from "./types";

export const SYNC_MODE_OPTIONS: {
  value: SettingsConfig["sync"]["mode"];
  label: string;
}[] = [
  { value: "push_pull", label: "Two-way" },
  { value: "pull_only", label: "Download only" },
  { value: "push_only", label: "Upload only" },
];

export const CONFLICT_POLICY_OPTIONS: {
  value: SettingsConfig["sync"]["conflictPolicy"];
  label: string;
}[] = [
  { value: "keep_both", label: "Keep both" },
  { value: "server_wins", label: "Prefer server" },
  { value: "device_wins", label: "Prefer this device" },
];
