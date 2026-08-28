import { useCallback, useEffect, useState } from "react";
import { getApi } from "../../api";
import { useNotification } from "../../components/NotificationProvider";
import {
  applyUiTheme,
  applyUiCrt,
  clampScanlineStrength,
  isUiTheme,
  DEFAULT_UI_SCANLINES,
  DEFAULT_UI_SCANLINE_STRENGTH,
  type UiTheme,
} from "../../theme";
import { AppearanceSection } from "./AppearanceSection";
import { AutoSyncSection } from "./AutoSyncSection";
import { RetrodeckSection } from "./RetrodeckSection";
import { RommSection } from "./RommSection";
import type { SettingsSectionId } from "./sections";
import { SettingsHeader } from "./SettingsHeader";
import { SettingsSectionNav } from "./SettingsSectionNav";
import type { PathsInfo, SettingsConfig } from "./types";
import { useDebouncedCallback } from "./useDebouncedCallback";

function normalizeUi(
  ui: SettingsConfig["ui"] | undefined,
): SettingsConfig["ui"] {
  return {
    theme: isUiTheme(ui?.theme) ? ui.theme : "candy",
    scanlines:
      typeof ui?.scanlines === "boolean" ? ui.scanlines : DEFAULT_UI_SCANLINES,
    scanlineStrength: clampScanlineStrength(
      typeof ui?.scanlineStrength === "number"
        ? ui.scanlineStrength
        : DEFAULT_UI_SCANLINE_STRENGTH,
    ),
  };
}

export function SettingsPage() {
  const [cfg, setCfg] = useState<SettingsConfig | null>(null);
  const [paths, setPaths] = useState<PathsInfo | null>(null);
  const [overridesText, setOverridesText] = useState("{}");
  const [overridesError, setOverridesError] = useState<string | null>(null);
  const { notifyOk, notifyError, clearNotification } = useNotification();
  const [testing, setTesting] = useState(false);
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>("appearance");

  useEffect(() => {
    void (async () => {
      const c = (await getApi().getConfig()) as SettingsConfig;
      const ui = normalizeUi(c.ui);
      setCfg({ ...c, ui });
      applyUiTheme(ui.theme);
      applyUiCrt({
        scanlines: ui.scanlines,
        scanlineStrength: ui.scanlineStrength,
      });
      setOverridesText(JSON.stringify(c.platformMapOverrides ?? {}, null, 2));
      setPaths((await getApi().getRetroDeckPaths()) as PathsInfo);
    })();
  }, []);

  const persistPartial = useCallback(
    async (partial: Partial<SettingsConfig>) => {
      try {
        const next = (await getApi().saveConfig(partial)) as SettingsConfig;
        setCfg({ ...next, ui: normalizeUi(next.ui) });
        clearNotification();
        if (partial.retrodeck) {
          setPaths((await getApi().getRetroDeckPaths()) as PathsInfo);
        }
      } catch (e) {
        notifyError(e instanceof Error ? e.message : String(e));
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

  const applyCrtFromUi = (ui: SettingsConfig["ui"]) => {
    applyUiCrt({
      scanlines: ui.scanlines,
      scanlineStrength: ui.scanlineStrength,
    });
  };

  const setTheme = async (theme: UiTheme) => {
    const ui = { ...cfg.ui, theme };
    applyUiTheme(theme);
    setCfg({ ...cfg, ui });
    await persistPartial({ ui });
  };

  const setScanlines = async (scanlines: boolean) => {
    const ui = { ...cfg.ui, scanlines };
    applyCrtFromUi(ui);
    setCfg({ ...cfg, ui });
    await persistPartial({ ui });
  };

  const setScanlineStrength = (scanlineStrength: number) => {
    const ui = {
      ...cfg.ui,
      scanlineStrength: clampScanlineStrength(scanlineStrength),
    };
    applyCrtFromUi(ui);
    setCfg({ ...cfg, ui });
    debouncedPersist({ ui });
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
    clearNotification();
    try {
      await persistPartial({ romm: cfg.romm });
      const result = await getApi().testConnection();
      if (result.ok)
        notifyOk(`Connected — ${result.platforms ?? 0} platforms`);
      else notifyError(result.error ?? "Connection failed");
    } catch (e) {
      notifyError(e instanceof Error ? e.message : String(e));
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
            scanlines={cfg.ui.scanlines}
            scanlineStrength={cfg.ui.scanlineStrength}
            onThemeChange={(theme) => void setTheme(theme)}
            onScanlinesChange={(enabled) => void setScanlines(enabled)}
            onScanlineStrengthChange={setScanlineStrength}
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
