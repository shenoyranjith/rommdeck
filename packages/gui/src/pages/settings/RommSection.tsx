import {
  Field,
  Panel,
  btnClass,
  inputClass,
} from "../../components/ui";
import type { SettingsConfig } from "./types";

export function RommSection({
  cfg,
  onChange,
  onTest,
  testing,
}: {
  cfg: SettingsConfig;
  onChange: (romm: SettingsConfig["romm"]) => void;
  onTest: () => void;
  testing: boolean;
}) {
  return (
    <Panel>
        <div className="p-4">
          <Field label="Base URL">
            <input
              className={inputClass}
              value={cfg.romm.baseUrl}
              onChange={(e) =>
                onChange({ ...cfg.romm, baseUrl: e.target.value })
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
                onChange({ ...cfg.romm, apiToken: e.target.value })
              }
              placeholder="rmm_…"
            />
          </Field>
          <button
            type="button"
            className={btnClass}
            disabled={testing}
            onClick={onTest}
          >
            {testing ? "Testing…" : "Test connection"}
          </button>
        </div>
      </Panel>
  );
}
