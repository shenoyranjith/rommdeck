import { Switch } from "../../components/Switch";
import { Field, Panel, inputClass } from "../../components/ui";
import type { PathsInfo, SettingsConfig } from "./types";

export function RetrodeckSection({
  cfg,
  paths,
  onRetrodeckChange,
  onSyncMetadataChange,
}: {
  cfg: SettingsConfig;
  paths: PathsInfo | null;
  onRetrodeckChange: (retrodeck: SettingsConfig["retrodeck"]) => void;
  onSyncMetadataChange: (enabled: boolean) => void;
}) {
  return (
    <Panel>
      <div className="p-4">
        <div className="mb-4">
          <p className="text-sm font-semibold text-text">Paths</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            RetroDECK install paths and ES-DE integration. Leave fields empty to
            auto-detect from{" "}
            <span className="font-mono text-[11px]">retrodeck.json</span>.
          </p>
        </div>

        <Field label="Config file">
          <input
            className={inputClass}
            value={cfg.retrodeck.configPath}
            onChange={(e) =>
              onRetrodeckChange({
                ...cfg.retrodeck,
                configPath: e.target.value,
              })
            }
            placeholder="Auto-detect"
          />
        </Field>
        <Field label="ROMs folder">
          <input
            className={inputClass}
            value={cfg.retrodeck.romsPath}
            onChange={(e) =>
              onRetrodeckChange({
                ...cfg.retrodeck,
                romsPath: e.target.value,
              })
            }
            placeholder="Auto-detect"
          />
        </Field>
        <Field label="Saves folder">
          <input
            className={inputClass}
            value={cfg.retrodeck.savesPath}
            onChange={(e) =>
              onRetrodeckChange({
                ...cfg.retrodeck,
                savesPath: e.target.value,
              })
            }
            placeholder="Auto-detect"
          />
        </Field>
        <Field label="States folder">
          <input
            className={inputClass}
            value={cfg.retrodeck.statesPath}
            onChange={(e) =>
              onRetrodeckChange({
                ...cfg.retrodeck,
                statesPath: e.target.value,
              })
            }
            placeholder="Auto-detect"
          />
        </Field>

        {paths && (
          <div className="mb-4 text-xs text-muted">
            <p className="mb-1 font-semibold text-text">Resolved paths</p>
            <p className="font-mono text-[11px] leading-relaxed">
              Source: {paths.source}
              <br />
              ROMs: {paths.romsPath || "—"}
              <br />
              Saves: {paths.savesPath || "—"}
              <br />
              States: {paths.statesPath || "—"}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text">
              Sync metadata on download
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Update gamelist.xml and download cover art from RomM after each
              ROM lands on disk.
            </p>
          </div>
          <div className="flex shrink-0 items-center self-center py-0.5">
            <Switch
              id="retrodeck-sync-metadata"
              checked={cfg.retrodeck.syncMetadataOnDownload}
              onCheckedChange={onSyncMetadataChange}
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}
