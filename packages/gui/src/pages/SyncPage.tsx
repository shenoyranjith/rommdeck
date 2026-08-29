import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getApi } from "../api";
import { cn } from "../lib/cn";
import { useNotification } from "../components/NotificationProvider";
import {
  PageHeader,
  Panel,
  btnPrimaryClass,
} from "../components/ui";

interface DaemonStatus {
  running: boolean;
  pid: number | null;
  lastSyncAt: string | null;
  lastResult: "ok" | "error" | "partial" | null;
  lastError: string | null;
  pendingConflicts: SyncConflict[];
  completedOps: number;
  failedOps: number;
  updatedAt: string;
}

interface SyncConflict {
  rom_id: number;
  file: string;
  type?: string;
  slot?: string | null;
  reason?: string;
}

interface SyncDiscoveryReport {
  indexedRomFiles: number;
  retroArchRomFiles: number;
  skippedStandalonePlatforms: string[];
  existingSaveFiles: number;
}

interface SyncOperationSummary {
  upload: number;
  download: number;
  conflict: number;
  no_op: number;
  total: number;
}

interface SyncResultReport {
  sessionId: string | number | null;
  completed: number;
  failed: number;
  conflicts: SyncConflict[];
  errors: string[];
  operations: SyncConflict[];
  discovery?: SyncDiscoveryReport;
  operationSummary: SyncOperationSummary;
  device?: {
    registered: boolean;
    updated: boolean;
  };
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function resultBadgeClass(result: DaemonStatus["lastResult"]): string {
  return cn(
    "inline-block border border-line bg-bg2 px-2 py-0.5 font-mono text-[11px] uppercase",
    result === "ok" && "border-ok/40 text-ok",
    result === "partial" && "border-warn/40 text-warn",
    result === "error" && "border-danger/40 text-danger",
  );
}

export function SyncPage() {
  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const { notifyOk, notifyError, clearNotification } = useNotification();
  const [lastManual, setLastManual] = useState<SyncResultReport | null>(null);

  const refresh = async () => {
    const s = (await getApi().daemonStatus()) as DaemonStatus;
    setStatus(s);
  };

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, []);

  const syncNow = async () => {
    setBusy(true);
    clearNotification();
    try {
      const result = (await getApi().syncNow()) as SyncResultReport;
      setLastManual(result);
      const summary = result.operationSummary;
      notifyOk(
        `Sync finished: ${result.completed} completed, ${result.failed} failed` +
          (summary.conflict > 0 ? `, ${summary.conflict} conflicts need review` : ""),
      );
      await refresh();
    } catch (e) {
      notifyError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const conflicts = lastManual
    ? lastManual.conflicts
    : (status?.pendingConflicts ?? []);

  const discovery = lastManual?.discovery;
  const opSummary = lastManual?.operationSummary;

  return (
    <div className="flex flex-col gap-4 pb-2">
      <PageHeader
        title="Sync"
        description="Manual save and state sync with RomM (RetroArch saves from RetroDECK). RomM web-player saves are not synced. Auto-sync runs in the background via the systemd daemon."
        actions={
          <button
            type="button"
            className={btnPrimaryClass}
            style={{ boxShadow: "var(--glow)" }}
            disabled={busy}
            onClick={() => void syncNow()}
          >
            {busy ? "Syncing…" : "Sync Now"}
          </button>
        }
      />

      <p className="text-sm text-muted">
        Configure interval, conflict policy, and auto-sync in{" "}
        <Link
          to="/settings?section=auto-sync"
          className="text-accent underline-offset-2 hover:underline"
        >
          Settings → Auto-sync
        </Link>
        .
      </p>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Sync status">
          <div className="space-y-2 p-4 text-sm">
            <p>
              Background daemon:{" "}
              <strong className={status?.running ? "text-ok" : "text-muted"}>
                {status?.running ? "running" : "not running"}
              </strong>
              {status?.pid != null && (
                <span className="ml-2 font-mono text-xs text-muted">
                  pid {status.pid}
                </span>
              )}
            </p>
            <p>
              Last sync:{" "}
              <span className="font-mono text-accent">
                {formatWhen(status?.lastSyncAt)}
              </span>
            </p>
            <p className="flex flex-wrap items-center gap-2">
              Last result:{" "}
              <span className={resultBadgeClass(status?.lastResult ?? null)}>
                {status?.lastResult ?? "—"}
              </span>
            </p>
            <p>
              Last run ops:{" "}
              <span className="font-mono text-accent">
                {status?.completedOps ?? 0} ok / {status?.failedOps ?? 0} failed
              </span>
            </p>
            {status?.lastError && (
              <div className="border border-danger/40 bg-bg2 px-3 py-2 text-danger">
                {status.lastError}
              </div>
            )}
            <p className="text-xs text-muted">
              Status updated {formatWhen(status?.updatedAt)}
            </p>
          </div>
        </Panel>

        <Panel title="Pending conflicts">
          {conflicts.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted">
              No pending conflicts
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] tracking-wide text-muted uppercase">
                  <th className="px-3 py-2.5 font-medium">ROM ID</th>
                  <th className="px-3 py-2.5 font-medium">File</th>
                  <th className="px-3 py-2.5 font-medium">Slot</th>
                </tr>
              </thead>
              <tbody>
                {conflicts.map((c, i) => (
                  <tr
                    key={`${c.rom_id}-${c.file}-${i}`}
                    className="border-b border-line/70"
                  >
                    <td className="px-3 py-2.5 font-mono text-accent">
                      {c.rom_id}
                    </td>
                    <td className="px-3 py-2.5 text-text">{c.file}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted">
                      {c.slot ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {lastManual && (
        <Panel title="Last manual sync" className="min-h-0">
          <div className="max-h-[min(28rem,50vh)] overflow-y-auto">
            <div className="space-y-4 p-4 text-sm">
            <p className="font-mono text-accent">
              session {String(lastManual.sessionId ?? "—")} · completed{" "}
              {lastManual.completed} · failed {lastManual.failed}
            </p>

            {lastManual.device && (lastManual.device.registered || lastManual.device.updated) && (
              <p className="text-muted">
                Device{" "}
                {lastManual.device.registered
                  ? "registered with RomM"
                  : "registration updated (paths or sync mode changed)"}
                .
              </p>
            )}

            {opSummary && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(
                  [
                    ["Upload", opSummary.upload],
                    ["Download", opSummary.download],
                    ["Conflict", opSummary.conflict],
                    ["No-op", opSummary.no_op],
                    ["Total", opSummary.total],
                  ] as const
                ).map(([label, count]) => (
                  <div
                    key={label}
                    className="border border-line bg-bg2 px-3 py-2 text-center"
                  >
                    <div className="text-[11px] tracking-wide text-muted uppercase">
                      {label}
                    </div>
                    <div className="font-mono text-lg text-accent">{count}</div>
                  </div>
                ))}
              </div>
            )}

            {discovery && (
              <div className="space-y-2 border border-line bg-bg2 px-3 py-3">
                <p className="text-[11px] tracking-wide text-muted uppercase">
                  Discovery
                </p>
                <ul className="space-y-1 text-muted">
                  <li>
                    Indexed ROM files:{" "}
                    <span className="font-mono text-text">
                      {discovery.indexedRomFiles}
                    </span>
                  </li>
                  <li>
                    RetroArch platforms:{" "}
                    <span className="font-mono text-text">
                      {discovery.retroArchRomFiles}
                    </span>
                  </li>
                  <li>
                    Local saves/states found:{" "}
                    <span className="font-mono text-text">
                      {discovery.existingSaveFiles}
                    </span>
                  </li>
                </ul>
                {discovery.skippedStandalonePlatforms.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs text-muted">
                      Skipped standalone-default platforms:
                    </p>
                    <p className="font-mono text-xs text-warn">
                      {discovery.skippedStandalonePlatforms.join(", ")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {lastManual.errors.length > 0 && (
              <div className="border border-danger/40 bg-bg2 px-3 py-2">
                <p className="mb-1 text-[11px] tracking-wide text-danger uppercase">
                  Errors
                </p>
                <ul className="list-inside list-disc text-muted">
                  {lastManual.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
