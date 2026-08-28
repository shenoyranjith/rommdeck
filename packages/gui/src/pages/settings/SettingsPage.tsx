import { useCallback, useEffect, useState } from "react";
import { getApi } from "../../api";
import { Alert } from "../../components/ui";
import { applyUiTheme, isUiTheme, type UiTheme } from "../../theme";
import { AppearanceSection } from "./AppearanceSection";
import { AutoSyncSection } from "./AutoSyncSection";
import { RetrodeckSection } from "./RetrodeckSection";
import { RommSection } from "./RommSection";
import type { SettingsSectionId } from "./sections";
import { SettingsHeader } from "./SettingsHeader";
import { SettingsSectionNav } from "./SettingsSectionNav";
import type { PathsInfo, SettingsConfig } from "./types";
import { useDebouncedCallback } from "./useDebouncedCallback";

export function SettingsPage() {
  const [cfg, setCfg] = useState<SettingsConfig | null>(null);
  const [paths, setPaths] = useState<PathsInfo | null>(null);
  const [overridesText, setOverridesText] = useState("{}");
  const [overridesError, setOverridesError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>("appearance");

  useEffect(() => {
    void (async () => {
      const c = (await getApi().getConfig()) as SettingsConfig;
      const theme = isUiTheme(c.ui?.theme) ? c.ui.theme : "candy";
      const normalized = { ...c, ui: { theme } };
      setCfg(normalized);
      applyUiTheme(theme);
      setOverridesText(JSON.stringify(c.platformMapOverrides ?? {}, null, 2));
      setPaths((await getApi().getRetroDeckPaths()) as PathsInfo);
    })();
  }, []);

  const persistPartial = useCallback(
    async (partial: Partial<SettingsConfig>) => {
      try {
        const next = (await getApi().saveConfig(partial)) as SettingsConfig;
        setCfg(next);
        setError(null);
        if (partial.retrodeck) {
          setPaths((await getApi().getRetroDeckPaths()) as PathsInfo);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [],
  );

  const debouncedPersist = useDebouncedCallback(persistPartial, 400);

  const debouncedOverridesPersist = useDebouncedCallback(async (text: string) => {
    try {
      const platformMapOverrides = JSON.parse(text) as Record<string, string>;
      if (
        platformMapOverrides === null ||
        typeof platformMapOverrides !== "object" ||
        Array.isArray(platformMapOverrides)
      ) {
        throw new Error("Platform map overrides must be a JSON object");
      }
      setOverridesError(null);
      await persistPartial({ platformMapOverrides });
    } catch (e) {
      if (e instanceof SyntaxError) {
        setOverridesError("Invalid JSON");
      } else {
        setOverridesError(
          e instanceof Error ? e.message : "Invalid platform map overrides",
        );
      }
    }
  }, 500);

  if (!cfg) {
    return (
      <div className="py-10 text-center text-sm text-muted">
        Loading settings…
      </div>
    );
  }

  const setTheme = async (theme: UiTheme) => {
    applyUiTheme(theme);
    setCfg({ ...cfg, ui: { theme } });
    await persistPartial({ ui: { theme } });
  };

  const updateRomm = (romm: SettingsConfig["romm"]) => {
    setCfg({ ...cfg, romm });
    debouncedPersist({ romm });
  };

  const updateRetrodeck = (retrodeck: SettingsConfig["retrodeck"]) => {
    setCfg({ ...cfg, retrodeck });
    debouncedPersist({ retrodeck });
  };

  const updateOverridesText = (text: string) => {
    setOverridesText(text);
    debouncedOverridesPersist(text);
  };

  const updateSync = (sync: SettingsConfig["sync"]) => {
    setCfg({ ...cfg, sync });
    debouncedPersist({ sync });
  };

  const test = async () => {
    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      await persistPartial({ romm: cfg.romm });
      const result = await getApi().testConnection();
      if (result.ok)
        setMessage(`Connected — ${result.platforms ?? 0} platforms`);
      else setError(result.error ?? "Connection failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  const pane = (() => {
    switch (activeSection) {
      case "appearance":
        return (
          <AppearanceSection
            theme={cfg.ui.theme}
            onThemeChange={(theme) => void setTheme(theme)}
          />
        );
      case "romm":
        return (
          <RommSection
            cfg={cfg}
            onChange={updateRomm}
            onTest={() => void test()}
            testing={testing}
          />
        );
      case "retrodeck":
        return (
          <RetrodeckSection
            cfg={cfg}
            paths={paths}
            overridesText={overridesText}
            overridesError={overridesError}
            onRetrodeckChange={updateRetrodeck}
            onOverridesChange={updateOverridesText}
          />
        );
      case "auto-sync":
        return (
          <AutoSyncSection cfg={cfg} onChange={updateSync} />
        );
    }
  })();

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <SettingsHeader />

      {message && <Alert tone="ok">{message}</Alert>}
      {error && <Alert tone="err">{error}</Alert>}

      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row md:gap-4">
        <SettingsSectionNav
          active={activeSection}
          onSelect={setActiveSection}
        />

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-1">
          {pane}
        </div>
      </div>
    </div>
  );
}
