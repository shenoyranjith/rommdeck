import { useEffect, useState } from "react";
import { getApi } from "../api";
import { cn } from "../lib/cn";
import {
  Alert,
  PageHeader,
  Panel,
  btnClass,
  btnPrimaryClass,
} from "../components/ui";

interface DaemonStatus {
  running: boolean;
  pid: number | null;
  lastSyncAt: string | null;
  lastResult: "ok" | "error" | "partial" | null;
  lastError: string | null;
  pendingConflicts: { rom_id: number; file: string; type: string }[];
  completedOps: number;
  failedOps: number;
  updatedAt: string;
}

interface SyncResult {
  sessionId: string | null;
  completed: number;
  failed: number;
  conflicts: { rom_id: number; file: string }[];
  errors: string[];
}

export function SyncPage() {
  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastManual, setLastManual] = useState<SyncResult | null>(null);

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
    setError(null);
    setMessage(null);
    try {
      const result = (await getApi().syncNow()) as SyncResult;
      setLastManual(result);
      setMessage(
        `Sync finished: ${result.completed} completed, ${result.failed} failed, ${result.conflicts.length} conflicts`,
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleDaemon = async (enable: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const cfg = await getApi().getConfig();
      await getApi().saveConfig({
        sync: { ...cfg.sync, enabled: enable },
      });
      const result = await getApi().systemctl(enable ? "enable" : "disable");
      setMessage(
        result.output || (enable ? "Auto-sync enabled" : "Auto-sync disabled"),
      );
      if (!result.ok && result.output) setError(result.output);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const conflicts = status?.pendingConflicts?.length
    ? status.pendingConflicts
    : (lastManual?.conflicts ?? []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader
        title="Sync"
        description="Device save/state sync with RomM. Daemon keeps running when the GUI is closed."
        actions={
          <>
            <button
              type="button"
              className={btnPrimaryClass}
              style={{ boxShadow: "var(--glow)" }}
              disabled={busy}
              onClick={() => void syncNow()}
            >
              {busy ? "Syncing…" : "Sync Now"}
            </button>
            <button
              type="button"
              className={btnClass}
              disabled={busy}
              onClick={() => void toggleDaemon(true)}
            >
              Enable auto-sync
            </button>
            <button
              type="button"
              className={btnClass}
              disabled={busy}
              onClick={() => void toggleDaemon(false)}
            >
              Disable auto-sync
            </button>
          </>
        }
      />

      {message && <Alert tone="ok">{message}</Alert>}
      {error && <Alert tone="err">{error}</Alert>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Panel title="Daemon status">
          <div className="space-y-2 p-4 text-sm">
            <p>
              Running:{" "}
              <strong className={status?.running ? "text-ok" : "text-danger"}>
                {status?.running ? "yes" : "no"}
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
                {status?.lastSyncAt ?? "never"}
              </span>
            </p>
            <p className="flex flex-wrap items-center gap-2">
              Last result:{" "}
              <span
                className={cn(
                  "inline-block border border-line bg-bg2 px-2 py-0.5 font-mono text-[11px] uppercase",
                  status?.lastResult === "ok" && "border-ok/40 text-ok",
                  status?.lastResult === "partial" &&
                    "border-warn/40 text-warn",
                  status?.lastResult === "error" &&
                    "border-danger/40 text-danger",
                )}
              >
                {status?.lastResult ?? "—"}
              </span>
            </p>
            <p>
              Ops:{" "}
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
              Updated {status?.updatedAt ?? "—"}
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {lastManual && (
        <Panel title="Last manual sync">
          <div className="space-y-2 p-4 text-sm">
            <p className="font-mono text-accent">
              session {lastManual.sessionId ?? "—"} · completed{" "}
              {lastManual.completed} · failed {lastManual.failed}
            </p>
            {lastManual.errors.length > 0 && (
              <ul className="list-inside list-disc text-muted">
                {lastManual.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
