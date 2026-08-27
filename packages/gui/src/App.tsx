import { useEffect } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { LibraryPage } from "./pages/LibraryPage";
import { DownloadsPage } from "./pages/DownloadsPage";
import { SyncPage } from "./pages/SyncPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StatusBar } from "./components/StatusBar";
import { IconDownloads, IconLibrary, IconSettings, IconSync } from "./components/icons";
import { cn } from "./lib/cn";
import { getApi } from "./api";
import { applyUiTheme, isUiTheme, DEFAULT_UI_THEME } from "./theme";

const NAV = [
  { to: "/", end: true, label: "Library", Icon: IconLibrary },
  { to: "/downloads", end: false, label: "Downloads", Icon: IconDownloads },
  { to: "/sync", end: false, label: "Sync", Icon: IconSync },
  { to: "/settings", end: false, label: "Settings", Icon: IconSettings },
] as const;

export function App() {
  useEffect(() => {
    void (async () => {
      try {
        const cfg = await getApi().getConfig();
        applyUiTheme(isUiTheme(cfg.ui?.theme) ? cfg.ui.theme : DEFAULT_UI_THEME);
      } catch {
        applyUiTheme(DEFAULT_UI_THEME);
      }
    })();
  }, []);

  return (
    <div className="relative flex h-full min-h-0 bg-bg0 text-text">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-50 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.55) 2px, rgba(0,0,0,0.55) 3px)",
        }}
      />

      <aside className="relative z-10 flex w-[200px] shrink-0 flex-col border-r border-line bg-bg1/80 px-3 py-4">
        <div className="mb-8 flex flex-col items-start gap-2 px-1">
          <div
            className="grid size-12 place-items-center rounded-md border border-accent bg-bg0 text-lg font-bold tracking-wide text-accent"
            style={{ boxShadow: "var(--glow)" }}
          >
            RD
          </div>
          <div className="text-base font-semibold tracking-wide text-text">RommDeck</div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ to, end, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-accent font-semibold text-accent-fg shadow-[var(--glow)]"
                    : "text-muted hover:bg-bg2 hover:text-text",
                )
              }
            >
              <Icon className="shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 rounded-md border border-line bg-bg0/60 px-3 py-2 text-[11px] leading-relaxed text-muted">
          <div className="font-medium text-text">RommDeck v0.1.0</div>
          <div className="font-mono">RomM → RetroDECK</div>
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col p-3">
        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-accent/70 bg-bg1/40"
          style={{ boxShadow: "var(--glow)" }}
        >
          <main className="min-h-0 flex-1 overflow-auto p-4 md:p-5">
            <Routes>
              <Route path="/" element={<LibraryPage />} />
              <Route path="/downloads" element={<DownloadsPage />} />
              <Route path="/sync" element={<SyncPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
          <StatusBar />
        </div>
      </div>
    </div>
  );
}
