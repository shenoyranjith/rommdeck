import { useEffect, useState } from "react";
import { getApi } from "../api";
import { IconCheck, IconClock, IconDatabase, IconSync, IconWarn } from "./icons";

interface DaemonStatus {
  running: boolean;
  lastSyncAt: string | null;
  lastResult: "ok" | "error" | "partial" | null;
  lastError: string | null;
  completedOps: number;
  failedOps: number;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function StatusBar() {
  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [queueLen, setQueueLen] = useState(0);

  useEffect(() => {
    const refresh = async () => {
      try {
        const s = (await getApi().daemonStatus()) as DaemonStatus;
        setStatus(s);
      } catch {
        /* ignore until API ready */
      }
      try {
        const jobs = (await getApi().listDownloads()) as { status: string }[];
        setQueueLen(jobs.filter((j) => j.status !== "done" && j.status !== "error" && j.status !== "cancelled").length);
      } catch {
        /* ignore */
      }
    };
    void refresh();
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, []);

  const daemonLabel = status?.running ? "Daemon on" : "Daemon off";
  const result = status?.lastResult;

  return (
    <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-4 py-2 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5">
        <IconDatabase className="text-accent" />
        <span className="text-text">Queue</span>
        <span className="font-mono text-accent">{queueLen}</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <IconSync className={status?.running ? "text-ok" : "text-muted"} />
        <span className="text-text">{daemonLabel}</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        {result === "error" ? (
          <IconWarn className="text-danger" />
        ) : result === "ok" || result === "partial" ? (
          <IconCheck className="text-ok" />
        ) : (
          <IconCheck className="text-muted" />
        )}
        <span className="text-text">Last sync</span>
        <span className="font-mono">{formatWhen(status?.lastSyncAt ?? null)}</span>
        {result && <span className="uppercase text-accent">{result}</span>}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <IconClock className="text-accent" />
        <span className="font-mono">
          {status?.completedOps ?? 0} ok / {status?.failedOps ?? 0} fail
        </span>
      </span>
      {status?.lastError && (
        <span className="truncate text-danger" title={status.lastError}>
          {status.lastError}
        </span>
      )}
    </footer>
  );
}
