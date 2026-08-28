import { useState } from "react";
import { getApi } from "../../api";
import {
  Field,
  Panel,
  btnClass,
  inputClass,
} from "../../components/ui";
import {
  IconCircleCheck,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconLoader,
  IconWarn,
} from "../../components/icons";
import type { RommConnectionStatus } from "../../components/RommConnectionProvider";
import { PlatformMapEditor } from "./PlatformMapEditor";
import type { SettingsConfig } from "./types";

function ConnectionStatusIcon({ status }: { status: RommConnectionStatus }) {
  switch (status.state) {
    case "checking":
      return (
        <IconLoader
          className="size-5 shrink-0 animate-spin text-muted"
          strokeWidth={2.15}
          aria-label="Checking connection"
        />
      );
    case "ok":
      return (
        <span title={`Connected — ${status.platforms} platforms`}>
          <IconCircleCheck
            className="size-5 shrink-0 text-ok"
            strokeWidth={2.15}
            aria-label={`Connected — ${status.platforms} platforms`}
          />
        </span>
      );
    case "error":
      return (
        <span title="Connection failed">
          <IconWarn
            className="size-5 shrink-0 text-danger"
            strokeWidth={2.15}
            aria-label="Connection failed"
          />
        </span>
      );
    default:
      return null;
  }
}

export function RommSection({
  cfg,
  connectionStatus,
  platformMapOverrides,
  onChange,
  onTest,
  onSavePlatformMapOverrides,
  testing,
}: {
  cfg: SettingsConfig;
  connectionStatus: RommConnectionStatus;
  platformMapOverrides: Record<string, string>;
  onChange: (romm: SettingsConfig["romm"]) => void;
  onTest: () => void;
  onSavePlatformMapOverrides: (
    overrides: Record<string, string>,
  ) => Promise<void>;
  testing: boolean;
}) {
  const [showToken, setShowToken] = useState(false);
  const [editingPlatformMap, setEditingPlatformMap] = useState(false);
  const showError = connectionStatus.state === "error";
  const canOpenUrl = cfg.romm.baseUrl.trim().length > 0;
  const overrideCount = Object.keys(platformMapOverrides).length;

  const openRommUrl = () => {
    if (!canOpenUrl) return;
    void getApi().openExternal(cfg.romm.baseUrl.trim());
  };

  if (editingPlatformMap) {
    return (
      <Panel className="flex max-h-[min(36rem,65vh)] min-h-[20rem] flex-col">
        <PlatformMapEditor
          overrides={platformMapOverrides}
          onSave={async (next) => {
            await onSavePlatformMapOverrides(next);
            setEditingPlatformMap(false);
          }}
          onCancel={() => setEditingPlatformMap(false)}
        />
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="p-4">
        <Field label="Base URL">
          <div className="relative">
            <input
              className={`${inputClass} pr-10`}
              value={cfg.romm.baseUrl}
              onChange={(e) =>
                onChange({ ...cfg.romm, baseUrl: e.target.value })
              }
              placeholder="http://192.168.1.10:8080"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center border-l border-line px-2.5 text-muted transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
              onClick={openRommUrl}
              disabled={!canOpenUrl}
              aria-label="Open RomM in browser"
              title="Open RomM in browser"
            >
              <IconExternalLink className="size-4" strokeWidth={2.15} />
            </button>
          </div>
        </Field>
        <Field label="Client API Token">
          <div className="relative">
            <input
              className={`${inputClass} pr-10 font-mono text-xs`}
              type={showToken ? "text" : "password"}
              value={cfg.romm.apiToken}
              onChange={(e) =>
                onChange({ ...cfg.romm, apiToken: e.target.value })
              }
              placeholder="rmm_…"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center border-l border-line px-2.5 text-muted transition-colors hover:text-text"
              onClick={() => setShowToken((visible) => !visible)}
              aria-label={showToken ? "Hide token" : "Show token"}
            >
              {showToken ? (
                <IconEyeOff className="size-4" strokeWidth={2.15} />
              ) : (
                <IconEye className="size-4" strokeWidth={2.15} />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Create in RomM → Administration → Client API Tokens. Required
            scopes: platforms and roms read,{" "}
            <span className="font-mono text-[11px]">assets.read</span>,{" "}
            <span className="font-mono text-[11px]">assets.write</span>,{" "}
            <span className="font-mono text-[11px]">devices.read</span>,{" "}
            <span className="font-mono text-[11px]">devices.write</span>.
          </p>
        </Field>

        <div className="mb-4">
          <button
            type="button"
            className={btnClass}
            onClick={() => setEditingPlatformMap(true)}
          >
            Platform map
            {overrideCount > 0 && (
              <span className="ml-1.5 font-mono text-xs text-muted">
                ({overrideCount} override{overrideCount === 1 ? "" : "s"})
              </span>
            )}
          </button>
          <p className="mt-1.5 text-xs text-muted">
            Map RomM platform slugs to ES-DE folders for downloads.
          </p>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={btnClass}
              disabled={testing || connectionStatus.state === "checking"}
              onClick={onTest}
            >
              {testing ? "Testing…" : "Test connection"}
            </button>
            <ConnectionStatusIcon
              status={
                testing || connectionStatus.state === "checking"
                  ? { state: "checking" }
                  : connectionStatus
              }
            />
          </div>
          {showError && (
            <p className="mt-2 text-sm text-danger">{connectionStatus.error}</p>
          )}
        </div>
      </div>
    </Panel>
  );
}
