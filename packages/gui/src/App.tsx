import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { LibraryPage } from "./pages/LibraryPage";
import { DownloadsPage } from "./pages/DownloadsPage";
import { SyncPage } from "./pages/SyncPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StatusBar } from "./components/StatusBar";
import { WindowControls } from "./components/WindowControls";
import { BrandMark } from "./components/BrandMark";
import {
  IconDownloads,
  IconLibrary,
  IconSettings,
  IconSync,
} from "./components/icons";
import { cn } from "./lib/cn";
import { getApi } from "./api";
import { applyUiTheme, applyUiCrt, isUiTheme, DEFAULT_UI_THEME, readStoredUiCrt, UI_CRT_EVENT, type UiCrtSettings } from "./theme";
import { useDownloadInventorySync } from "./hooks/useDownloadInventorySync";
import { ConfirmProvider } from "./components/ConfirmProvider";
import { NotificationProvider, NotificationAnchor } from "./components/NotificationProvider";
import { RommConnectionProvider } from "./components/RommConnectionProvider";

const NAV = [
  { to: "/", end: true, label: "Library", Icon: IconLibrary },
  { to: "/downloads", end: false, label: "Downloads", Icon: IconDownloads },
  { to: "/sync", end: false, label: "Sync", Icon: IconSync },
  { to: "/settings", end: false, label: "Settings", Icon: IconSettings },
] as const;

export function App() {
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [crt, setCrt] = useState<UiCrtSettings>(readStoredUiCrt);
  useDownloadInventorySync();

  useEffect(() => {
    const onCrt = (e: Event) => {
      setCrt((e as CustomEvent<UiCrtSettings>).detail);
    };
    window.addEventListener(UI_CRT_EVENT, onCrt);
    return () => window.removeEventListener(UI_CRT_EVENT, onCrt);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const cfg = await getApi().getConfig();
        applyUiTheme(
          isUiTheme(cfg.ui?.theme) ? cfg.ui.theme : DEFAULT_UI_THEME,
        );
        applyUiCrt({
          scanlines:
            typeof cfg.ui?.scanlines === "boolean"
              ? cfg.ui.scanlines
              : readStoredUiCrt().scanlines,
          scanlineStrength:
            typeof cfg.ui?.scanlineStrength === "number"
              ? cfg.ui.scanlineStrength
              : readStoredUiCrt().scanlineStrength,
        });
      } catch {
        applyUiTheme(DEFAULT_UI_THEME);
      }
      try {
        setAppVersion(await getApi().getAppVersion());
      } catch {
        setAppVersion(null);
      }
    })();
  }, []);

  return (
    <ConfirmProvider>
      <NotificationProvider>
      <RommConnectionProvider>
      <div className="relative h-full w-full min-h-0 min-w-0 overflow-hidden bg-bg0 text-text">
      {crt.scanlines && (
        <div
          aria-hidden
          className="crt-scanlines pointer-events-none absolute inset-0 z-50"
        />
      )}

      <div className="relative z-10 flex h-full min-h-0">
        {/* Drag strip for frameless window (controls are no-drag) */}
        <div
          aria-hidden
          className="app-drag absolute inset-x-0 top-0 z-30 h-10"
        />
        {/* Share top/right edges with the outer window accent ring */}
        <WindowControls className="absolute top-0 right-0 z-40 border-t-0 border-r-0" />

        <aside className="app-no-drag relative z-20 flex w-[232px] shrink-0 flex-col border-r border-accent/80 bg-bg1/90 px-3 py-5">
          <div className="app-drag mb-10 flex w-full flex-col items-center gap-3.5 px-1">
            <BrandMark />
            <div className="text-center text-[1.85rem] leading-none font-bold tracking-wide text-text">
              RommDeck
            </div>
          </div>

          <nav className="app-no-drag flex flex-1 flex-col gap-1.5">
            {NAV.map(({ to, end, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 border px-3 py-3 text-lg font-semibold transition-colors",
                    isActive
                      ? "border-accent border-l-[6px] bg-accent/15 font-bold text-accent"
                      : "border-transparent text-text hover:bg-bg2/60",
                  )
                }
              >
                <Icon className="size-8 shrink-0" strokeWidth={2.15} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-4 border border-accent bg-bg0 px-3 py-2.5 text-center">
            <div className="text-[16px] font-bold leading-snug text-text">
              {appVersion ? `RommDeck v${appVersion}` : "RommDeck"}
            </div>
            <div className="mt-1 text-[15px] leading-snug font-normal text-muted">
              RomM → RetroDECK
            </div>
          </div>
        </aside>

        <div className="app-no-drag relative z-20 flex min-h-0 min-w-0 flex-1 flex-col bg-bg0 pt-9 pr-3 pb-3 pl-2">
          <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 md:px-5">
            <main className="min-h-0 flex-1 overflow-auto">
              <Routes>
                <Route path="/" element={<LibraryPage />} />
                <Route path="/downloads" element={<DownloadsPage />} />
                <Route path="/sync" element={<SyncPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </main>
            <div className="relative shrink-0">
              <NotificationAnchor />
              <StatusBar />
            </div>
          </div>
        </div>
      </div>
      </div>
      </RommConnectionProvider>
      </NotificationProvider>
    </ConfirmProvider>
  );
}
