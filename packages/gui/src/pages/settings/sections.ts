export const SETTINGS_SECTIONS = [
  { id: "appearance", label: "Appearance" },
  { id: "romm", label: "RomM" },
  { id: "retrodeck", label: "Retrodeck" },
  { id: "auto-sync", label: "Auto-sync" },
  { id: "logging", label: "Logging" },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];
