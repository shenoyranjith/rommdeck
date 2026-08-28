import { Field, Panel, inputClass, textareaClass } from "../../components/ui";
import type { PathsInfo, SettingsConfig } from "./types";

export function RetrodeckSection({
  cfg,
  paths,
  overridesText,
  overridesError,
  onRetrodeckChange,
  onOverridesChange,
}: {
  cfg: SettingsConfig;
  paths: PathsInfo | null;
  overridesText: string;
  overridesError?: string | null;
  onRetrodeckChange: (retrodeck: SettingsConfig["retrodeck"]) => void;
  onOverridesChange: (text: string) => void;
}) {
  return (
    <Panel>
        <div className="p-4">
          <Field label="retrodeck.json path (empty = auto-detect)">
            <input
              className={inputClass}
              value={cfg.retrodeck.configPath}
              onChange={(e) =>
                onRetrodeckChange({
                  ...cfg.retrodeck,
                  configPath: e.target.value,
                })
              }
            />
          </Field>
          <Field label="roms_path override">
            <input
              className={inputClass}
              value={cfg.retrodeck.romsPath}
              onChange={(e) =>
                onRetrodeckChange({
                  ...cfg.retrodeck,
                  romsPath: e.target.value,
                })
              }
            />
          </Field>
          <Field label="saves_path override">
            <input
              className={inputClass}
              value={cfg.retrodeck.savesPath}
              onChange={(e) =>
                onRetrodeckChange({
                  ...cfg.retrodeck,
                  savesPath: e.target.value,
                })
              }
            />
          </Field>
          <Field label="states_path override">
            <input
              className={inputClass}
              value={cfg.retrodeck.statesPath}
              onChange={(e) =>
                onRetrodeckChange({
                  ...cfg.retrodeck,
                  statesPath: e.target.value,
                })
              }
            />
          </Field>
          {paths && (
            <p className="mb-4 font-mono text-[11px] text-muted">
              Resolved ({paths.source}): roms={paths.romsPath || "—"}, saves=
              {paths.savesPath || "—"}, states={paths.statesPath || "—"}
            </p>
          )}

          <p className="mb-3 text-sm text-muted">
            Platform map overrides — JSON object mapping RomM slug → ES-DE
            folder (e.g.{" "}
            <span className="font-mono text-accent">{'{"ngc":"gc"}'}</span>).
          </p>
          <Field label="Overrides">
            <textarea
              className={textareaClass}
              rows={10}
              value={overridesText}
              onChange={(e) => onOverridesChange(e.target.value)}
              spellCheck={false}
            />
          </Field>
          {overridesError && (
            <p className="text-sm text-danger">{overridesError}</p>
          )}
        </div>
      </Panel>
  );
}
