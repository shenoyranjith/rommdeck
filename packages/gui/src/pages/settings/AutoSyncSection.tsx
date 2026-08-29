import { useEffect, useState } from "react";
import { getApi } from "../../api";
import { useNotification } from "../../components/NotificationProvider";
import { Switch } from "../../components/Switch";
import { Field, Panel, inputClass, selectClass, btnClass } from "../../components/ui";
import type { SettingsConfig } from "./types";
import { CONFLICT_POLICY_OPTIONS, SYNC_MODE_OPTIONS } from "./syncLabels";

interface DaemonStatus {
  running: boolean;
  pid: number | null;
  lastSyncAt: string | null;
  lastResult: "ok" | "error" | "partial" | null;
}

export function AutoSyncSection({
  cfg,
  onChange,
  onEnableChange,
  systemctlBusy,
}: {
  cfg: SettingsConfig;
  onChange: (sync: SettingsConfig["sync"]) => void;
  onEnableChange: (enabled: boolean) => Promise<void>;
  systemctlBusy: boolean;
}) {
  const [daemon, setDaemon] = useState<DaemonStatus | null>(null);
  const [unitInstalled, setUnitInstalled] = useState<boolean | null>(null);
  const [installBusy, setInstallBusy] = useState(false);
  const { notifyOk, notifyError } = useNotification();

  useEffect(() => {
    const refresh = async () => {
      try {
        setDaemon((await getApi().daemonStatus()) as DaemonStatus);
        setUnitInstalled(await getApi().daemonInstalled());
      } catch {
        setDaemon(null);
        setUnitInstalled(null);
      }
    };
    void refresh();
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, []);

  const installDaemon = async () => {
    setInstallBusy(true);
    try {
      const result = await getApi().installDaemon();
      if (result.ok) {
        setUnitInstalled(true);
        notifyOk("Sync daemon installed");
      } else {
        notifyError(result.output || "Install failed");
      }
    } catch (e) {
      notifyError(e instanceof Error ? e.message : String(e));
    } finally {
      setInstallBusy(false);
    }
  };

  return (
    <Panel>
      <div className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <Switch
              checked={cfg.sync.enabled}
              disabled={systemctlBusy}
              onCheckedChange={(enabled) => void onEnableChange(enabled)}
            />
            <span className="font-semibold text-text">Enable auto-sync</span>
          </label>
          <p className="text-xs text-muted">
            Daemon:{" "}
            <span className={daemon?.running ? "text-ok" : "text-muted"}>
              {daemon?.running ? "running" : "stopped"}
            </span>
            {daemon?.pid != null && (
              <span className="ml-1 font-mono">pid {daemon.pid}</span>
            )}
          </p>
        </div>

        {unitInstalled === false && (
          <div className="mb-4 flex flex-wrap items-center gap-2 border border-line bg-bg2 px-3 py-2 text-sm">
            <span className="text-muted">Sync daemon not installed.</span>
            <button
              type="button"
              className={btnClass}
              disabled={installBusy || systemctlBusy}
              onClick={() => void installDaemon()}
            >
              {installBusy ? "Installing…" : "Install"}
            </button>
          </div>
        )}

        <Field label="Device name">
          <input
            className={inputClass}
            value={cfg.sync.deviceName}
            onChange={(e) =>
              onChange({ ...cfg.sync, deviceName: e.target.value })
            }
          />
        </Field>
        <Field label="Sync direction">
          <select
            className={selectClass}
            value={cfg.sync.mode}
            onChange={(e) =>
              onChange({
                ...cfg.sync,
                mode: e.target.value as SettingsConfig["sync"]["mode"],
              })
            }
          >
            {SYNC_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Interval (seconds)">
          <input
            className={inputClass}
            type="number"
            min={60}
            value={cfg.sync.intervalSeconds}
            onChange={(e) =>
              onChange({
                ...cfg.sync,
                intervalSeconds: Number(e.target.value) || 300,
              })
            }
          />
        </Field>
        <Field label="Save watch debounce (seconds)">
          <input
            className={inputClass}
            type="number"
            min={5}
            value={cfg.sync.debounceSeconds}
            onChange={(e) =>
              onChange({
                ...cfg.sync,
                debounceSeconds: Number(e.target.value) || 45,
              })
            }
          />
        </Field>
        <Field label="Conflict policy">
          <select
            className={selectClass}
            value={cfg.sync.conflictPolicy}
            onChange={(e) =>
              onChange({
                ...cfg.sync,
                conflictPolicy: e.target
                  .value as SettingsConfig["sync"]["conflictPolicy"],
              })
            }
          >
            {CONFLICT_POLICY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            Used when local and server copies both changed. Applies to manual Sync
            Now and the background daemon.
          </p>
        </Field>

        <details className="mb-3 border border-line bg-bg2/40 px-3 py-2 text-sm">
          <summary className="cursor-pointer text-text">Advanced</summary>
          <div className="mt-3 space-y-3">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={cfg.sync.registerNewDevice ?? false}
                onChange={(e) =>
                  onChange({
                    ...cfg.sync,
                    registerNewDevice: e.target.checked,
                  })
                }
              />
              <span>
                <span className="text-text">Register as new device on next sync</span>
                <span className="mt-0.5 block text-xs text-muted">
                  One-shot. RomM dedupes by hostname — use this to simulate another
                  machine.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={cfg.sync.resetSyncHistory ?? false}
                onChange={(e) =>
                  onChange({
                    ...cfg.sync,
                    resetSyncHistory: e.target.checked,
                  })
                }
              />
              <span>
                <span className="text-text">Reset sync history on next registration</span>
                <span className="mt-0.5 block text-xs text-muted">
                  One-shot. Re-download server saves after deleting local files.
                </span>
              </span>
            </label>
          </div>
        </details>

        <p className="text-sm text-muted">
          Device ID:{" "}
          <span className="font-mono text-accent">
            {cfg.sync.deviceId ?? "not registered"}
          </span>
        </p>
      </div>
    </Panel>
  );
}
