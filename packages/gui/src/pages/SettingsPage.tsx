import { useEffect, useState } from "react";
import { getApi } from "../api";
import {
  Alert,
  Field,
  PageHeader,
  Panel,
  btnClass,
  btnPrimaryClass,
  inputClass,
  selectClass,
  textareaClass,
} from "../components/ui";
import {
  UI_THEMES,
  UI_THEME_LABELS,
  applyUiTheme,
  isUiTheme,
  type UiTheme,
} from "../theme";
import { cn } from "../lib/cn";

interface Config {
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
  ui: { theme: UiTheme };
  platformMapOverrides: Record<string, string>;
}

interface PathsInfo {
  configPath: string;
  romsPath: string;
  savesPath: string;
  statesPath: string;
  source: string;
}

export function SettingsPage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [paths, setPaths] = useState<PathsInfo | null>(null);
  const [overridesText, setOverridesText] = useState("{}");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void (async () => {
      const c = (await getApi().getConfig()) as Config;
      const theme = isUiTheme(c.ui?.theme) ? c.ui.theme : "candy";
      const normalized = { ...c, ui: { theme } };
      setCfg(normalized);
      applyUiTheme(theme);
      setOverridesText(JSON.stringify(c.platformMapOverrides ?? {}, null, 2));
      setPaths((await getApi().getRetroDeckPaths()) as PathsInfo);
    })();
  }, []);

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
    try {
      const next = await getApi().saveConfig({ ui: { theme } });
      setCfg(next as Config);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const save = async () => {
    setError(null);
    setMessage(null);
    try {
      let platformMapOverrides: Record<string, string> = {};
      try {
        platformMapOverrides = JSON.parse(overridesText) as Record<
          string,
          string
        >;
      } catch {
        throw new Error("Platform map overrides must be valid JSON object");
      }
      const next = await getApi().saveConfig({
        ...cfg,
        platformMapOverrides,
      });
      setCfg(next as Config);
      if (isUiTheme((next as Config).ui?.theme)) {
        applyUiTheme((next as Config).ui.theme);
      }
      setPaths((await getApi().getRetroDeckPaths()) as PathsInfo);
      setMessage("Settings saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const test = async () => {
    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      await getApi().saveConfig({ romm: cfg.romm });
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader
        title="Settings"
        description={
          <>
            Shared with{" "}
            <span className="font-mono text-accent">rommdeck-syncd</span>
          </>
        }
        actions={
          <>
            <button
              type="button"
              className={btnClass}
              disabled={testing}
              onClick={() => void test()}
            >
              Test connection
            </button>
            <button
              type="button"
              className={btnPrimaryClass}
              style={{ boxShadow: "var(--glow)" }}
              onClick={() => void save()}
            >
              Save
            </button>
          </>
        }
      />

      {message && <Alert tone="ok">{message}</Alert>}
      {error && <Alert tone="err">{error}</Alert>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Panel title="Appearance">
          <div className="p-4">
            <p className="mb-3 text-sm text-muted">
              Color scheme only — shell layout stays the same. Applies
              immediately.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {UI_THEMES.map((theme) => {
                const active = cfg.ui.theme === theme;
                return (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => void setTheme(theme)}
                    className={cn(
                      "border px-3 py-3 text-left text-sm transition-colors",
                      active
                        ? "border-accent bg-accent text-accent-fg shadow-[var(--glow)]"
                        : "border-line bg-bg0 text-text hover:border-accent/60",
                    )}
                  >
                    <div className="font-semibold">
                      {UI_THEME_LABELS[theme]}
                    </div>
                    <div
                      className={cn(
                        "mt-0.5 font-mono text-[11px]",
                        active ? "opacity-80" : "text-muted",
                      )}
                    >
                      {theme}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Panel>

        <Panel title="RomM">
          <div className="p-4">
            <Field label="Base URL">
              <input
                className={inputClass}
                value={cfg.romm.baseUrl}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    romm: { ...cfg.romm, baseUrl: e.target.value },
                  })
                }
                placeholder="http://192.168.1.10:8080"
              />
            </Field>
            <Field label="Client API Token">
              <input
                className={inputClass}
                type="password"
                value={cfg.romm.apiToken}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    romm: { ...cfg.romm, apiToken: e.target.value },
                  })
                }
                placeholder="rmm_…"
              />
            </Field>
          </div>
        </Panel>

        <Panel title="RetroDECK paths">
          <div className="p-4">
            <Field label="retrodeck.json path (empty = auto-detect)">
              <input
                className={inputClass}
                value={cfg.retrodeck.configPath}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    retrodeck: { ...cfg.retrodeck, configPath: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="roms_path override">
              <input
                className={inputClass}
                value={cfg.retrodeck.romsPath}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    retrodeck: { ...cfg.retrodeck, romsPath: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="saves_path override">
              <input
                className={inputClass}
                value={cfg.retrodeck.savesPath}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    retrodeck: { ...cfg.retrodeck, savesPath: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="states_path override">
              <input
                className={inputClass}
                value={cfg.retrodeck.statesPath}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    retrodeck: { ...cfg.retrodeck, statesPath: e.target.value },
                  })
                }
              />
            </Field>
            {paths && (
              <p className="mt-1 font-mono text-[11px] text-muted">
                Resolved ({paths.source}): roms={paths.romsPath || "—"}
              </p>
            )}
          </div>
        </Panel>

        <Panel title="Auto-sync">
          <div className="p-4">
            <Field label="Device name">
              <input
                className={inputClass}
                value={cfg.sync.deviceName}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    sync: { ...cfg.sync, deviceName: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Sync mode">
              <select
                className={selectClass}
                value={cfg.sync.mode}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    sync: {
                      ...cfg.sync,
                      mode: e.target.value as Config["sync"]["mode"],
                    },
                  })
                }
              >
                <option value="push_pull">push_pull</option>
                <option value="pull_only">pull_only</option>
                <option value="push_only">push_only</option>
              </select>
            </Field>
            <Field label="Interval (seconds)">
              <input
                className={inputClass}
                type="number"
                min={60}
                value={cfg.sync.intervalSeconds}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    sync: {
                      ...cfg.sync,
                      intervalSeconds: Number(e.target.value) || 300,
                    },
                  })
                }
              />
            </Field>
            <Field label="FS debounce (seconds)">
              <input
                className={inputClass}
                type="number"
                min={5}
                value={cfg.sync.debounceSeconds}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    sync: {
                      ...cfg.sync,
                      debounceSeconds: Number(e.target.value) || 45,
                    },
                  })
                }
              />
            </Field>
            <Field label="Unattended conflict policy">
              <select
                className={selectClass}
                value={cfg.sync.conflictPolicy}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    sync: {
                      ...cfg.sync,
                      conflictPolicy: e.target
                        .value as Config["sync"]["conflictPolicy"],
                    },
                  })
                }
              >
                <option value="keep_both">keep_both</option>
                <option value="server_wins">server_wins</option>
                <option value="device_wins">device_wins</option>
              </select>
            </Field>
            <p className="text-sm text-muted">
              Device ID:{" "}
              <span className="font-mono text-accent">
                {cfg.sync.deviceId ?? "not registered"}
              </span>
            </p>
          </div>
        </Panel>

        <Panel title="Platform map overrides" className="md:col-span-2">
          <div className="p-4">
            <p className="mb-3 text-sm text-muted">
              JSON object mapping RomM slug → ES-DE folder (e.g.{" "}
              <span className="font-mono text-accent">{'{"ngc":"gc"}'}</span>).
            </p>
            <Field label="Overrides">
              <textarea
                className={textareaClass}
                rows={10}
                value={overridesText}
                onChange={(e) => setOverridesText(e.target.value)}
                spellCheck={false}
              />
            </Field>
          </div>
        </Panel>
      </div>
    </div>
  );
}
