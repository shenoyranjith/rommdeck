import { useEffect, useState } from "react";
import { getApi } from "../api";

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
      setMessage(result.output || (enable ? "Auto-sync enabled" : "Auto-sync disabled"));
      if (!result.ok && result.output) setError(result.output);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const resultClass =
    status?.lastResult === "ok"
      ? "status-ok"
      : status?.lastResult === "partial"
        ? "status-partial"
        : status?.lastResult === "error"
          ? "status-error"
          : "";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sync</h1>
          <p>Device save/state sync with RomM. Daemon keeps running when the GUI is closed.</p>
        </div>
        <div className="toolbar">
          <button className="btn btn-primary" disabled={busy} onClick={() => void syncNow()}>
            {busy ? "Syncing…" : "Sync Now"}
          </button>
          <button className="btn" disabled={busy} onClick={() => void toggleDaemon(true)}>
            Enable auto-sync
          </button>
          <button className="btn" disabled={busy} onClick={() => void toggleDaemon(false)}>
            Disable auto-sync
          </button>
        </div>
      </div>

      {message && <div className="message ok">{message}</div>}
      {error && <div className="message err">{error}</div>}

      <div className="settings-grid">
        <div className="panel">
          <div className="panel-title">Daemon status</div>
          <div style={{ padding: "1rem" }}>
            <p>
              Running:{" "}
              <strong className={status?.running ? "status-ok" : "status-error"}>
                {status?.running ? "yes" : "no"}
              </strong>
              {status?.pid != null && <span className="muted mono"> · pid {status.pid}</span>}
            </p>
            <p>
              Last sync:{" "}
              <span className="mono">{status?.lastSyncAt ?? "never"}</span>
            </p>
            <p>
              Last result:{" "}
              <span className={`status-pill ${resultClass}`}>{status?.lastResult ?? "—"}</span>
            </p>
            <p>
              Ops:{" "}
              <span className="mono">
                {status?.completedOps ?? 0} ok / {status?.failedOps ?? 0} failed
              </span>
            </p>
            {status?.lastError && (
              <p className="message err" style={{ marginTop: "0.75rem" }}>
                {status.lastError}
              </p>
            )}
            <p className="muted" style={{ fontSize: "0.8rem" }}>
              Updated {status?.updatedAt ?? "—"}
            </p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Pending conflicts</div>
          {(status?.pendingConflicts?.length ?? 0) === 0 && !lastManual?.conflicts.length ? (
            <div className="empty">No pending conflicts</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>ROM ID</th>
                  <th>File</th>
                </tr>
              </thead>
              <tbody>
                {(status?.pendingConflicts ?? lastManual?.conflicts ?? []).map((c, i) => (
                  <tr key={`${c.rom_id}-${c.file}-${i}`}>
                    <td className="mono">{c.rom_id}</td>
                    <td>{c.file}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {lastManual && (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="panel-title">Last manual sync</div>
          <div style={{ padding: "1rem" }}>
            <p className="mono">
              session {lastManual.sessionId ?? "—"} · completed {lastManual.completed} · failed{" "}
              {lastManual.failed}
            </p>
            {lastManual.errors.length > 0 && (
              <ul>
                {lastManual.errors.map((e) => (
                  <li key={e} className="muted">
                    {e}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
