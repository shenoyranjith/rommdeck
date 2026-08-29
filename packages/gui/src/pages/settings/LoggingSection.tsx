import { LOG_LEVELS, LOG_LEVEL_LABELS, type LogLevel } from "./loggingLabels";
import { Field, Panel, btnClass, selectClass } from "../../components/ui";

export function LoggingSection({
  level,
  logPath,
  onLevelChange,
  onOpenLog,
}: {
  level: LogLevel;
  logPath: string | null;
  onLevelChange: (level: LogLevel) => void;
  onOpenLog: () => void;
}) {
  return (
    <Panel>
      <div className="p-4">
        <p className="mb-4 text-sm text-muted">
          RommDeck writes structured logs for the GUI, downloads, sync, and the
          background daemon.
        </p>

        <Field label="Log level">
          <select
            className={selectClass}
            value={level}
            onChange={(e) => onLevelChange(e.target.value as LogLevel)}
          >
            {LOG_LEVELS.map((opt) => (
              <option key={opt} value={opt}>
                {LOG_LEVEL_LABELS[opt]}
              </option>
            ))}
          </select>
        </Field>

        <div className="mt-4 space-y-2 border border-line bg-bg0/50 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Log file
          </p>
          <p className="break-all font-mono text-xs text-text">
            {logPath ?? "…"}
          </p>
          <button
            type="button"
            className={btnClass}
            disabled={!logPath}
            onClick={onOpenLog}
          >
            Open log file
          </button>
        </div>
      </div>
    </Panel>
  );
}
