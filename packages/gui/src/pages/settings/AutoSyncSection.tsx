import { Field, Panel, inputClass, selectClass } from "../../components/ui";
import type { SettingsConfig } from "./types";

export function AutoSyncSection({
  cfg,
  onChange,
}: {
  cfg: SettingsConfig;
  onChange: (sync: SettingsConfig["sync"]) => void;
}) {
  return (
    <Panel>
        <div className="p-4">
          <Field label="Device name">
            <input
              className={inputClass}
              value={cfg.sync.deviceName}
              onChange={(e) =>
                onChange({ ...cfg.sync, deviceName: e.target.value })
              }
            />
          </Field>
          <Field label="Sync mode">
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
                onChange({
                  ...cfg.sync,
                  intervalSeconds: Number(e.target.value) || 300,
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
                onChange({
                  ...cfg.sync,
                  debounceSeconds: Number(e.target.value) || 45,
                })
              }
            />
          </Field>
          <Field label="Unattended conflict policy">
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
              <option value="keep_both">keep_both</option>
              <option value="server_wins">server_wins</option>
              <option value="device_wins">device_wins</option>
            </select>
          </Field>
          <label className="mb-3 flex cursor-pointer items-start gap-2 text-sm last:mb-0">
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
                RomM matches devices by hostname. Clearing device ID alone reuses the
                same device. Enable this once to simulate a second machine (one-shot).
              </span>
            </span>
          </label>
          <label className="mb-3 flex cursor-pointer items-start gap-2 text-sm last:mb-0">
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
                Re-download server saves on the same device after you deleted local
                files (RomM otherwise treats that as intentional). One-shot.
              </span>
            </span>
          </label>
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
