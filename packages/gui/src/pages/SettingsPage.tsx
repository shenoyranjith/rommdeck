import { useEffect, useState } from "react";
import { getApi } from "../api";

interface Config {
  profile: "dev" | "prod";
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
      setCfg(c);
      setOverridesText(JSON.stringify(c.platformMapOverrides ?? {}, null, 2));
      setPaths((await getApi().getRetroDeckPaths()) as PathsInfo);
    })();
  }, []);

  if (!cfg) return <div className="empty">Loading settings…</div>;

  const save = async () => {
    setError(null);
    setMessage(null);
    try {
      let platformMapOverrides: Record<string, string> = {};
      try {
        platformMapOverrides = JSON.parse(overridesText) as Record<string, string>;
      } catch {
        throw new Error("Platform map overrides must be valid JSON object");
      }
      const next = await getApi().saveConfig({
        ...cfg,
        platformMapOverrides,
      });
      setCfg(next as Config);
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
      if (result.ok) setMessage(`Connected — ${result.platforms ?? 0} platforms`);
      else setError(result.error ?? "Connection failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>
            Profile <span className="mono">{cfg.profile}</span> · shared with{" "}
            <span className="mono">rommdeck-syncd</span>
          </p>
        </div>
        <div className="toolbar">
          <button className="btn" disabled={testing} onClick={() => void test()}>
            Test connection
          </button>
          <button className="btn btn-primary" onClick={() => void save()}>
            Save
          </button>
        </div>
      </div>

      {message && <div className="message ok">{message}</div>}
      {error && <div className="message err">{error}</div>}

      <div className="settings-grid">
        <div className="panel">
          <div className="panel-title">RomM</div>
          <div style={{ padding: "1rem" }}>
            <div className="field">
              <label>Base URL</label>
              <input
                value={cfg.romm.baseUrl}
                onChange={(e) => setCfg({ ...cfg, romm: { ...cfg.romm, baseUrl: e.target.value } })}
                placeholder="http://192.168.1.10:8080"
              />
            </div>
            <div className="field">
              <label>Client API Token</label>
              <input
                type="password"
                value={cfg.romm.apiToken}
                onChange={(e) => setCfg({ ...cfg, romm: { ...cfg.romm, apiToken: e.target.value } })}
                placeholder="rmm_…"
              />
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">RetroDECK paths</div>
          <div style={{ padding: "1rem" }}>
            <div className="field">
              <label>retrodeck.json path (empty = auto-detect)</label>
              <input
                value={cfg.retrodeck.configPath}
                onChange={(e) =>
                  setCfg({ ...cfg, retrodeck: { ...cfg.retrodeck, configPath: e.target.value } })
                }
              />
            </div>
            <div className="field">
              <label>roms_path override</label>
              <input
                value={cfg.retrodeck.romsPath}
                onChange={(e) =>
                  setCfg({ ...cfg, retrodeck: { ...cfg.retrodeck, romsPath: e.target.value } })
                }
              />
            </div>
            <div className="field">
              <label>saves_path override</label>
              <input
                value={cfg.retrodeck.savesPath}
                onChange={(e) =>
                  setCfg({ ...cfg, retrodeck: { ...cfg.retrodeck, savesPath: e.target.value } })
                }
              />
            </div>
            <div className="field">
              <label>states_path override</label>
              <input
                value={cfg.retrodeck.statesPath}
                onChange={(e) =>
                  setCfg({ ...cfg, retrodeck: { ...cfg.retrodeck, statesPath: e.target.value } })
                }
              />
            </div>
            {paths && (
              <p className="muted mono" style={{ fontSize: "0.75rem" }}>
                Resolved ({paths.source}): roms={paths.romsPath || "—"}
              </p>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Auto-sync</div>
          <div style={{ padding: "1rem" }}>
            <div className="field">
              <label>Device name</label>
              <input
                value={cfg.sync.deviceName}
                onChange={(e) => setCfg({ ...cfg, sync: { ...cfg.sync, deviceName: e.target.value } })}
              />
            </div>
            <div className="field">
              <label>Sync mode</label>
              <select
                value={cfg.sync.mode}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    sync: { ...cfg.sync, mode: e.target.value as Config["sync"]["mode"] },
                  })
                }
              >
                <option value="push_pull">push_pull</option>
                <option value="pull_only">pull_only</option>
                <option value="push_only">push_only</option>
              </select>
            </div>
            <div className="field">
              <label>Interval (seconds)</label>
              <input
                type="number"
                min={60}
                value={cfg.sync.intervalSeconds}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    sync: { ...cfg.sync, intervalSeconds: Number(e.target.value) || 300 },
                  })
                }
              />
            </div>
            <div className="field">
              <label>FS debounce (seconds)</label>
              <input
                type="number"
                min={5}
                value={cfg.sync.debounceSeconds}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    sync: { ...cfg.sync, debounceSeconds: Number(e.target.value) || 45 },
                  })
                }
              />
            </div>
            <div className="field">
              <label>Unattended conflict policy</label>
              <select
                value={cfg.sync.conflictPolicy}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    sync: {
                      ...cfg.sync,
                      conflictPolicy: e.target.value as Config["sync"]["conflictPolicy"],
                    },
                  })
                }
              >
                <option value="keep_both">keep_both</option>
                <option value="server_wins">server_wins</option>
                <option value="device_wins">device_wins</option>
              </select>
            </div>
            <p className="muted">
              Device ID: <span className="mono">{cfg.sync.deviceId ?? "not registered"}</span>
            </p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Platform map overrides</div>
          <div style={{ padding: "1rem" }}>
            <p className="muted" style={{ marginTop: 0 }}>
              JSON object mapping RomM slug → ES-DE folder (e.g.{" "}
              <span className="mono">{'{"ngc":"gc"}'}</span>).
            </p>
            <div className="field">
              <label>Overrides</label>
              <textarea
                rows={10}
                value={overridesText}
                onChange={(e) => setOverridesText(e.target.value)}
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
