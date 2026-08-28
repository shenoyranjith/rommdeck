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
